const express = require("express");
const { destinations } = require("../data/destinations");
const { searchRoutes, applyFilters, filtersFromChips } = require("../matching");
const { ollamaChat } = require("../llm");

const router = express.Router();

function catalogForPrompt(pool) {
  return pool.map((d) => ({
    id: d.id,
    name: d.name,
    country: d.country,
    tagline: d.tagline,
    tags: d.tags,
    season: d.season,
    basePricePerNight: d.basePricePerNight,
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
{"reply": "kullanıcıya gösterilecek kısa, samimi Türkçe cevap", "destinationIds": ["id1","id2"], "nights": 2}
"nights": kullanıcının belirttiği gece sayısı; belirtmediyse 2 kullan.`;
}

function extractJson(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("LLM cevabı JSON içermiyor");
  return JSON.parse(match[0]);
}

function buildRoutes(chosenDestinations, nights) {
  return chosenDestinations.map((dest) => {
    const price = Math.round(dest.basePricePerNight * nights);
    return {
      destinationId: dest.id,
      name: dest.name,
      country: dest.country,
      tagline: dest.tagline,
      image: dest.image,
      nights,
      price,
      priceLabel: `₺${price.toLocaleString("tr-TR")}`,
      directFlight: dest.directFlight,
      hotelStars: dest.hotelStars,
    };
  });
}

async function llmSearch({ text, chipFilters, history }) {
  const filters = filtersFromChips(chipFilters);
  const pool = applyFilters(destinations, filters);

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

  return {
    source: "llm",
    reply: typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : "Buyur, dinliyorum.",
    routes: buildRoutes(chosen, nights),
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
    const fallback = searchRoutes({ text, chipFilters });
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

router.get("/suggestions", (req, res) => {
  const roma = destinations.find((d) => d.id === "roma");
  res.json({
    fromHistory: roma
      ? { destinationId: roma.id, name: roma.name, message: `Geçen ay ${roma.name}'ya baktın.` }
      : null,
  });
});

module.exports = router;
