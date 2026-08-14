const express = require("express");
const { getCatalog, resolveDestinations } = require("../catalog");
const { searchRoutes, applyFilters, filtersFromChips } = require("../matching");
const { ollamaChat } = require("../llm");
const { buildPricedRoutes, resolveTravelWindow } = require("../pricing");

const router = express.Router();

function catalogForPrompt(pool) {
  return pool.map((d) => ({
    id: d.id,
    name: d.name,
    country: d.country,
    tagline: d.tagline,
    tags: d.tags,
    season: d.season,
    directFlight: d.directFlight,
    hotelStars: d.hotelStars,
  }));
}

function systemPrompt(today) {
  return `Sen "Ayşe" adlı kullanıcı için çalışan bir seyahat concierge asistanısın. Her zaman Türkçe konuş.
Bugünün tarihi: ${today}. Kalkış her zaman İstanbul (IST).

ÖNCE TARİH SOR. Kullanıcı gidiş ve dönüş tarihini (veya en azından hangi ay ve kaç gece olduğunu) söylemediyse, rota önerme; kibarca tarih sor ve destinations dizisini boş bırak. Tarihi öğrendikten sonra rotaları öner.

Rota seçerken:
- Sana örnek olarak popüler rotalardan bir katalog verilecek. Bu katalog SINIRLI DEĞİL; kullanıcı katalogda olmayan bir yer isterse (New York, Tokyo, Bangkok vb.) onu da yazabilirsin. "Katalogumda yok" deme.
- Kullanıcı ülke veya bölge söylerse (Amerika, Uzak Doğu gibi) bunu somut ŞEHİRLERE çevir. Örnek: "Amerika" -> New York, Los Angeles, Miami.
- Her şehir için mutlaka şu üçünü ver: İngilizce şehir adı, şehrin ana havalimanının 3 harfli IATA kodu ve ülkenin 2 harfli ISO kodu. Örnek: Milano -> {"name":"Milan","iata":"MIL","country":"IT"}, Venedik -> {"name":"Venice","iata":"VCE","country":"IT"}, New York -> {"name":"New York","iata":"NYC","country":"US"}.
- Şehrin birden fazla havalimanı varsa şehir kodunu tercih et (Milano için MXP değil MIL, Londra için LHR değil LON, New York için JFK değil NYC).
- En fazla 3 şehir öner.
- Seyahatle ilgisi olmayan mesajlarda destinations dizisini boş bırak, sadece normal cevap ver.

Cevabını SADECE şu JSON şemasında ver, başka hiçbir metin, açıklama veya markdown ekleme:
{"reply":"kullanıcıya gösterilecek kısa, samimi Türkçe cevap","destinations":[{"name":"New York","iata":"NYC","country":"US"},{"name":"Miami","iata":"MIA","country":"US"}],"departDate":"2026-09-12","returnDate":"2026-09-16","nights":4,"month":"eylul","needsDates":false}

"departDate"/"returnDate": YYYY-AA-GG biçiminde, bilmiyorsan null. Geçmiş bir tarih verme.
"nights": gece sayısı; tarihlerden hesaplanabiliyorsa yazmana gerek yok.
"month": tarih yok ama ay belliyse; küçük harf ve şapkasız (ocak, subat, mart, nisan, mayis, haziran, temmuz, agustos, eylul, ekim, kasim, aralik). Yoksa null.
"needsDates": tarih sorman gerekiyorsa true.

Fiyatları sen hesaplama ve uydurma; fiyatlar sistem tarafından canlı uçuş verisiyle eklenir.`;
}

function extractJson(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("LLM cevabı JSON içermiyor");
  return JSON.parse(match[0]);
}

const VALID_MONTHS = new Set([
  "ocak", "subat", "mart", "nisan", "mayis", "haziran",
  "temmuz", "agustos", "eylul", "ekim", "kasim", "aralik",
]);

async function llmSearch({ text, chipFilters, history }) {
  const filters = filtersFromChips(chipFilters);
  const pool = applyFilters(await getCatalog(), filters);
  const today = new Date().toISOString().slice(0, 10);

  const messages = [
    { role: "system", content: systemPrompt(today) },
    {
      role: "system",
      content: `Örnek popüler rotalar (sınırlayıcı değil): ${JSON.stringify(catalogForPrompt(pool))}`,
    },
    ...history,
    { role: "user", content: text },
  ];

  const raw = await ollamaChat(messages);
  const parsed = extractJson(raw);

  const reply =
    typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : "Buyur, dinliyorum.";

  // The assistant is told to hold off on routes until it knows the dates.
  if (parsed.needsDates === true) {
    return { source: "llm", reply, needsDates: true, routes: [] };
  }

  const month =
    typeof parsed.month === "string" && VALID_MONTHS.has(parsed.month.toLowerCase())
      ? parsed.month.toLowerCase()
      : null;

  const window = resolveTravelWindow({
    departDate: parsed.departDate,
    returnDate: parsed.returnDate,
    month,
    nights: Number.isFinite(parsed.nights) ? Math.max(1, Math.min(30, parsed.nights)) : null,
  });

  // Accept both the free-form names the prompt asks for and, defensively, the
  // catalog ids an older prompt shape might still produce.
  const names = Array.isArray(parsed.destinations) ? parsed.destinations : [];
  const ids = Array.isArray(parsed.destinationIds) ? parsed.destinationIds : [];
  const fromIds = ids.map((id) => pool.find((d) => d.id === id)).filter(Boolean);
  const fromNames = await resolveDestinations(names);

  const chosen = [];
  const seen = new Set();
  for (const d of [...fromNames, ...fromIds]) {
    if (seen.has(d.iata)) continue;
    seen.add(d.iata);
    chosen.push(d);
    if (chosen.length === 3) break;
  }

  const routes = await buildPricedRoutes(chosen, window);

  // Everything the assistant named failed to resolve or price — say so instead
  // of silently showing an empty result under a confident reply.
  if (routes.length === 0 && (names.length > 0 || ids.length > 0)) {
    return {
      source: "llm",
      reply: `${reply}\n\n(Bu rotalar için şu an fiyat bulamadım, başka bir tarih veya şehir dener misin?)`,
      routes: [],
    };
  }

  return { source: "llm", reply, window, routes };
}

router.post("/search", async (req, res) => {
  const { text, chipFilters, history } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text alanı zorunludur" });
  }

  try {
    const result = await llmSearch({
      text,
      chipFilters,
      history: Array.isArray(history) ? history.slice(-8) : [],
    });
    return res.json(result);
  } catch (llmError) {
    const fallback = await searchRoutes({ text, chipFilters });
    return res.json({
      source: "rule",
      reply:
        fallback.routes.length > 0
          ? `En uygun ${fallback.routes.length} rota buldum`
          : "Bu kriterlere uygun bir rota bulamadım, filtreleri değiştirmeyi dener misin?",
      parsed: fallback.parsed,
      routes: fallback.routes,
      llmError: llmError.message,
    });
  }
});

router.get("/suggestions", async (req, res) => {
  const catalog = await getCatalog();
  const pick = catalog.find((d) => d.id === "roma") || catalog[0];
  res.json({
    fromHistory: pick
      ? { destinationId: pick.id, name: pick.name, message: `Geçen ay ${pick.name}'ya baktın.` }
      : null,
  });
});

module.exports = router;
