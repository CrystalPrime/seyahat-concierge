const { getCatalog } = require("./catalog");
const { buildPricedRoutes } = require("./pricing");

const MONTHS = [
  "ocak", "subat", "şubat", "mart", "nisan", "mayis", "mayıs", "haziran",
  "temmuz", "agustos", "ağustos", "eylul", "eylül", "ekim", "kasim", "kasım", "aralik", "aralık",
];

const MONTH_CANON = {
  subat: "subat", şubat: "subat",
  mayis: "mayis", mayıs: "mayis",
  agustos: "agustos", ağustos: "agustos",
  eylul: "eylul", eylül: "eylul",
  kasim: "kasim", kasım: "kasim",
  aralik: "aralik", aralık: "aralik",
};

const WEEKDAYS = ["pazartesi", "sali", "salı", "carsamba", "çarşamba", "persembe", "perşembe", "cuma", "cumartesi", "pazar"];

function normalize(text) {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function detectMonth(normText) {
  for (const m of MONTHS) {
    const key = normalize(m);
    if (normText.includes(key)) {
      return MONTH_CANON[key] || key;
    }
  }
  return null;
}

function detectNights(normText) {
  const days = WEEKDAYS.map(normalize);
  const found = days.filter((d) => normText.includes(d));
  if (found.length >= 2) return 2;
  if (normText.includes("hafta sonu") || normText.includes("haftasonu")) return 2;
  const weekMatch = normText.match(/(\d+)\s*(gece|gun|gün)/);
  if (weekMatch) return Math.max(1, parseInt(weekMatch[1], 10));
  return 2;
}

function detectTagPreferences(normText) {
  const tags = [];
  if (normText.includes("deniz") || normText.includes("plaj") || normText.includes("sahil")) tags.push("deniz");
  if (normText.includes("sehir") || normText.includes("şehir")) tags.push("sehir");
  if (normText.includes("doga") || normText.includes("dağ") || normText.includes("dag")) tags.push("doga");
  if (normText.includes("tarih") || normText.includes("kultur") || normText.includes("kültür")) tags.push("tarihi", "kultur");
  if (normText.includes("balon")) tags.push("balon");
  if (normText.includes("romantik") || normText.includes("gunbatimi") || normText.includes("gün batımı")) tags.push("romantik");
  return tags;
}

function detectExplicitFilters(normText) {
  const filters = new Set();
  if (normText.includes("butce") || normText.includes("bütçe") || normText.includes("ucuz") || normText.includes("ekonomik")) {
    filters.add("budget");
  }
  if (normText.includes("aktarmasiz") || normText.includes("aktarmasız") || normText.includes("direkt")) {
    filters.add("direct");
  }
  const starMatch = normText.match(/(\d)\s*yildiz/);
  if (starMatch) {
    filters.add(`stars-${starMatch[1]}`);
  } else if (normText.includes("yildizli otel") || normText.includes("yıldızlı otel")) {
    filters.add("stars-5");
  }
  return filters;
}

const CHIP_FILTER_MAP = {
  "butce-dostu": "budget",
  "aktarmasiz-ucuslar": "direct",
  "5-yildizli-otel": "stars-5",
};

// Rough pre-API cost proxy, used only to rank/filter before live prices are
// fetched. Assumes a two-night stay.
function estimatedCost(dest) {
  return dest.fallbackFlightPrice + dest.hotelPricePerNight * 2;
}

function applyFilters(items, filters) {
  let result = items;
  if (filters.has("budget")) {
    const BUDGET_CEILING = 9000;
    const affordable = result.filter((d) => estimatedCost(d) <= BUDGET_CEILING);
    result = affordable.length
      ? affordable
      : [...result].sort((a, b) => estimatedCost(a) - estimatedCost(b)).slice(0, 3);
  }
  if (filters.has("direct")) {
    const directOnly = result.filter((d) => d.directFlight);
    if (directOnly.length) result = directOnly;
  }
  for (const f of filters) {
    if (f.startsWith("stars-")) {
      const min = parseInt(f.split("-")[1], 10);
      const starred = result.filter((d) => d.hotelStars >= min);
      if (starred.length) result = starred;
    }
  }
  return result;
}

function scoreDestination(dest, { month, tags }) {
  let score = 0;
  if (month && dest.season.includes(month)) score += 3;
  for (const t of tags) {
    if (dest.tags.includes(t)) score += 2;
  }
  if (dest.editorsPick) score += 0.5;
  return score;
}

async function searchRoutes({ text, chipFilters = [] }) {
  const normText = normalize(text || "");
  const month = detectMonth(normText);
  const nights = detectNights(normText);
  const tags = detectTagPreferences(normText);
  const filters = detectExplicitFilters(normText);
  for (const chip of chipFilters) {
    const mapped = CHIP_FILTER_MAP[chip];
    if (mapped) filters.add(mapped);
  }

  let pool = applyFilters(await getCatalog(), filters);

  const scored = pool
    .map((dest) => ({ dest, score: scoreDestination(dest, { month, tags }) }))
    .sort((a, b) => b.score - a.score);

  const top = (scored.some((s) => s.score > 0) ? scored.filter((s) => s.score > 0) : scored).slice(0, 3);

  const routes = await buildPricedRoutes(top.map(({ dest }) => dest), nights, month);

  return {
    parsed: { month, nights, tags, filters: [...filters] },
    routes,
  };
}

function filtersFromChips(chipFilters = []) {
  const filters = new Set();
  for (const chip of chipFilters) {
    const mapped = CHIP_FILTER_MAP[chip];
    if (mapped) filters.add(mapped);
  }
  return filters;
}

module.exports = { searchRoutes, normalize, applyFilters, filtersFromChips };
