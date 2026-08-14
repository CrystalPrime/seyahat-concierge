const express = require("express");
const { getCatalog } = require("../catalog");
const { searchRoutes, applyFilters, filtersFromChips } = require("../matching");
const { ollamaChat } = require("../llm");
const { buildPricedRoutes } = require("../pricing");

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

function systemPrompt() {
  return `Sen "Ayşe" adlı kullanıcı için çalışan bir seyahat concierge asistanısın. Her zaman Türkçe konuş.
Sana JSON formatında bir destinasyon kataloğu verilecek. Kullanıcının mesajına göre:
- Eğer bir seyahat/rota isteği varsa, SADECE verilen katalogdaki id'lerden en uygun EN FAZLA 3 tanesini seç. Katalogda olmayan bir yer uydurma.
- Eğer mesaj seyahatle ilgili değilse (genel sohbet, soru, vb.) destinationIds dizisini boş bırak, sadece normal ve yardımcı bir cevap ver.
Cevabını SADECE şu JSON şemasında ver, başka hiçbir metin, açıklama veya markdown ekleme:
{"reply": "kullanıcıya gösterilecek kısa, samimi Türkçe cevap", "destinationIds": ["id1","id2"], "nights": 2, "month": "mayis"}
"nights": kullanıcının belirttiği gece sayısı; belirtmediyse 2 kullan.
"month": kullanıcının belirttiği ay; Türkçe küçük harf ve şapkasız yaz (ocak, subat, mart, nisan, mayis, haziran, temmuz, agustos, eylul, ekim, kasim, aralik). Ay belirtilmediyse null bırak.
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

  const messages = [
    { role: "system", content: systemPrompt() },
    { role: "system", content: `Destinasyon kataloğu: ${JSON.stringify(catalogForPrompt(pool))}` },
    ...history,
    { role: "user", content: text },
  ];

  const raw = await ollamaChat(messages);
  const parsed = extractJson(raw);
  const nights = Number.isFinite(parsed.nights) ? Math.max(1, Math.min(14, parsed.nights)) : 2;
  const chosen = (Array.isArray(parsed.destinationIds) ? parsed.destinationIds : [])
    .map((id) => pool.find((d) => d.id === id))
    .filter(Boolean)
    .slice(0, 3);

  const month =
    typeof parsed.month === "string" && VALID_MONTHS.has(parsed.month.toLowerCase())
      ? parsed.month.toLowerCase()
      : null;

  return {
    source: "llm",
    reply: typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : "Buyur, dinliyorum.",
    routes: await buildPricedRoutes(chosen, nights, month),
  };
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
