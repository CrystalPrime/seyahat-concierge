// Live flight prices from the Travelpayouts (Aviasales) Data API.
//
// Endpoint: GET /v1/prices/cheap
//   ?origin=IST&destination=BCN&depart_date=YYYY-MM&currency=try
//   Auth: X-Access-Token header.
//
// Response shape:
//   { success: true, data: { BCN: { "0": { price, airline, flight_number,
//     departure_at, return_at, expires_at }, "1": {...}, "2": {...} } } }
// The numeric keys are the number of stops, so "0" is a non-stop flight.
//
// Every failure path here returns null rather than throwing: callers fall back
// to the catalog's fallbackFlightPrice so the app still works without a token.

const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.TRAVELPAYOUTS_BASE_URL || "https://api.travelpayouts.com";
const TOKEN = process.env.TRAVELPAYOUTS_TOKEN || "";
const CURRENCY = process.env.TRAVELPAYOUTS_CURRENCY || "try";
const TIMEOUT_MS = Number(process.env.TRAVELPAYOUTS_TIMEOUT_MS) || 15000;
// city-directions returns every route out of a city and is noticeably slower
// than a single price lookup.
const DIRECTIONS_TIMEOUT_MS = Number(process.env.TRAVELPAYOUTS_DIRECTIONS_TIMEOUT_MS) || 30000;
// The reference dumps are multi-megabyte files; they need a much longer window.
const REF_TIMEOUT_MS = Number(process.env.TRAVELPAYOUTS_REF_TIMEOUT_MS) || 120000;
const CACHE_TTL_MS = Number(process.env.TRAVELPAYOUTS_CACHE_TTL_MS) || 30 * 60 * 1000;

const cache = new Map();

function isConfigured() {
  return Boolean(TOKEN);
}

function cacheKey(origin, destination, departMonth) {
  return `${origin}:${destination}:${departMonth || "any"}`;
}

function readCache(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function writeCache(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Turns the by-stops object into { cheapest, direct } prices.
function parseOffers(offersByStops) {
  if (!offersByStops || typeof offersByStops !== "object") return null;

  let cheapest = null;
  let direct = null;

  for (const [stops, offer] of Object.entries(offersByStops)) {
    const price = Number(offer?.price);
    if (!Number.isFinite(price) || price <= 0) continue;

    if (cheapest === null || price < cheapest.price) {
      cheapest = { price, airline: offer.airline || null, stops: Number(stops) };
    }
    if (stops === "0" && (direct === null || price < direct.price)) {
      direct = { price, airline: offer.airline || null, stops: 0 };
    }
  }

  if (!cheapest) return null;
  return { cheapest, direct };
}

/**
 * Cheapest round-trip flight price for a route.
 * @returns {Promise<{cheapest:{price:number,airline:string|null,stops:number},
 *                    direct:{price:number,airline:string|null,stops:number}|null,
 *                    currency:string}|null>}
 */
async function getFlightPrice({ origin, destination, departDate, returnDate }) {
  if (!isConfigured()) return null;

  const key = cacheKey(origin, destination, `${departDate || "any"}|${returnDate || "any"}`);
  const cached = readCache(key);
  if (cached !== undefined) return cached;

  // depart_date/return_date accept YYYY-MM or YYYY-MM-DD.
  const params = new URLSearchParams({ origin, destination, currency: CURRENCY });
  if (departDate) params.set("depart_date", departDate);
  if (returnDate) params.set("return_date", returnDate);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/v1/prices/cheap?${params.toString()}`, {
      headers: { "X-Access-Token": TOKEN, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[travelpayouts] ${origin}->${destination} HTTP ${res.status}`);
      writeCache(key, null);
      return null;
    }
    const body = await res.json();
    if (!body?.success) {
      console.warn(`[travelpayouts] ${origin}->${destination} success=false`);
      writeCache(key, null);
      return null;
    }
    const parsed = parseOffers(body?.data?.[destination]);
    const value = parsed ? { ...parsed, currency: (body.currency || CURRENCY).toUpperCase() } : null;
    writeCache(key, value);
    return value;
  } catch (e) {
    const reason = e.name === "AbortError" ? `timeout (${TIMEOUT_MS}ms)` : e.message;
    console.warn(`[travelpayouts] ${origin}->${destination} başarısız: ${reason}`);
    writeCache(key, null);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Looks up several destinations at once, tolerating individual failures. */
async function getFlightPrices({ origin, destinations, departDate, returnDate }) {
  const results = await Promise.all(
    destinations.map(async (destination) => [
      destination,
      await getFlightPrice({ origin, destination, departDate, returnDate }),
    ])
  );
  return Object.fromEntries(results);
}

/**
 * Popular real routes from a city, cheapest ticket per destination.
 * GET /v1/city-directions?origin=IST&currency=try
 * Response: { success, data: { BCN: { destination, price, transfers, airline,
 *   departure_at, return_at }, ... }, error, currency }
 * @returns {Promise<Array<{destination:string,price:number,transfers:number,
 *   airline:string|null,departureAt:string|null,returnAt:string|null}>|null>}
 */
async function getCityDirections({ origin }) {
  if (!isConfigured()) return null;

  const key = `directions:${origin}`;
  const cached = readCache(key);
  if (cached !== undefined) return cached;

  const params = new URLSearchParams({ origin, currency: CURRENCY });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DIRECTIONS_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/v1/city-directions?${params.toString()}`, {
      headers: { "X-Access-Token": TOKEN, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[travelpayouts] city-directions ${origin} HTTP ${res.status}`);
      writeCache(key, null);
      return null;
    }
    const body = await res.json();
    if (!body?.success || !body?.data) {
      console.warn(`[travelpayouts] city-directions ${origin} success=false`);
      writeCache(key, null);
      return null;
    }
    const routes = Object.entries(body.data)
      .map(([iata, r]) => ({
        destination: r?.destination || iata,
        price: Number(r?.price),
        transfers: Number.isFinite(Number(r?.transfers)) ? Number(r.transfers) : null,
        airline: r?.airline || null,
        departureAt: r?.departure_at || null,
        returnAt: r?.return_at || null,
      }))
      .filter((r) => Number.isFinite(r.price) && r.price > 0)
      .sort((a, b) => a.price - b.price);

    writeCache(key, routes);
    return routes;
  } catch (e) {
    const reason = e.name === "AbortError" ? `timeout (${DIRECTIONS_TIMEOUT_MS}ms)` : e.message;
    console.warn(`[travelpayouts] city-directions ${origin} başarısız: ${reason}`);
    writeCache(key, null);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// City/country reference data. These are static JSON dumps (no token needed),
// large enough that we download once and keep only the fields we use.
const REF_LOCALE = process.env.TRAVELPAYOUTS_LOCALE || "en";
const REF_TTL_MS = 24 * 60 * 60 * 1000;
let refPromise = null;
let refLoadedAt = 0;

async function fetchJson(url, { attempts = 2 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REF_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "Accept-Encoding": "gzip" },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastError = e.name === "AbortError" ? new Error(`timeout (${REF_TIMEOUT_MS}ms)`) : e;
      if (attempt < attempts) {
        console.warn(`[travelpayouts] ${url} denemesi ${attempt} başarısız (${lastError.message}), tekrar deneniyor`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

// The reference dumps rarely change, so the trimmed index is persisted and
// reused across restarts instead of re-downloading several megabytes.
const REF_CACHE_PATH = path.join(__dirname, "..", "..", "data", "city-index.json");
const REF_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readDiskCache() {
  try {
    const stat = fs.statSync(REF_CACHE_PATH);
    if (Date.now() - stat.mtimeMs > REF_CACHE_MAX_AGE_MS) return null;
    const raw = JSON.parse(fs.readFileSync(REF_CACHE_PATH, "utf-8"));
    if (!Array.isArray(raw?.cities) || raw.cities.length === 0) return null;
    console.log(`[travelpayouts] şehir indeksi diskten yüklendi: ${raw.cities.length} şehir`);
    return buildIndex(raw.cities);
  } catch {
    return null;
  }
}

function writeDiskCache(entries) {
  try {
    fs.mkdirSync(path.dirname(REF_CACHE_PATH), { recursive: true });
    fs.writeFileSync(REF_CACHE_PATH, JSON.stringify({ cities: entries }));
  } catch (e) {
    console.warn(`[travelpayouts] şehir indeksi diske yazılamadı: ${e.message}`);
  }
}

/** @param {Array<{iata,name,country,countryCode,aliases}>} entries */
function buildIndex(entries) {
  const byCode = new Map();
  const byName = new Map();
  for (const entry of entries) {
    byCode.set(entry.iata, entry);
    for (const alias of entry.aliases || [entry.name]) {
      const key = normalizeName(alias);
      if (!key) continue;
      // Names are ambiguous (Venice IT vs Venice FL), so every candidate is
      // kept and the caller ranks them instead of taking whichever came first.
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(entry);
    }
  }
  return { byCode, byName };
}

async function loadReferenceData() {
  const fromDisk = readDiskCache();
  if (fromDisk) return fromDisk;

  const locales = [REF_LOCALE, "en"].filter((v, i, a) => a.indexOf(v) === i);
  let lastError = null;

  for (const locale of locales) {
    try {
      const [cities, countries] = await Promise.all([
        fetchJson(`${BASE_URL}/data/${locale}/cities.json`),
        fetchJson(`${BASE_URL}/data/${locale}/countries.json`),
      ]);

      const countryByCode = new Map();
      for (const c of Array.isArray(countries) ? countries : []) {
        if (c?.code) countryByCode.set(c.code, c.name || c.code);
      }

      const entries = [];
      for (const c of Array.isArray(cities) ? cities : []) {
        if (!c?.code || !c?.name) continue;
        // Aliases cover every translation the dump offers, so "Londra"
        // resolves as well as "London".
        const aliases = [c.name, ...Object.values(c.name_translations || {})].filter(
          (a) => typeof a === "string" && a.trim()
        );
        entries.push({
          iata: c.code,
          name: c.name,
          countryCode: c.country_code || null,
          country: c.country_code ? countryByCode.get(c.country_code) || null : null,
          aliases: [...new Set(aliases)],
        });
      }

      if (entries.length === 0) throw new Error("boş şehir listesi");
      writeDiskCache(entries);
      const index = buildIndex(entries);
      console.log(
        `[travelpayouts] referans veri yüklendi (${locale}): ${index.byCode.size} şehir, ${index.byName.size} isim`
      );
      return index;
    } catch (e) {
      lastError = e;
      console.warn(`[travelpayouts] referans veri (${locale}) alınamadı: ${e.message}`);
    }
  }
  throw lastError || new Error("referans veri alınamadı");
}

function normalizeName(text) {
  return String(text)
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** @returns {Promise<{byCode:Map,byName:Map}|null>} */
async function getCityIndex() {
  if (refPromise && Date.now() - refLoadedAt < REF_TTL_MS) return refPromise;
  refLoadedAt = Date.now();
  refPromise = loadReferenceData().catch((e) => {
    console.warn(`[travelpayouts] referans veri devre dışı: ${e.message}`);
    refPromise = null;
    refLoadedAt = 0;
    return null;
  });
  return refPromise;
}

const IATA_RE = /^[A-Za-z]{3}$/;

/**
 * Picks the best city for an ambiguous name. "Venice" matches both VCE (Italy)
 * and VNC (Venice, Florida); without ranking the first one in the dump wins and
 * we end up pricing the wrong airport.
 */
function rankCandidates(candidates, { name, countryCode }) {
  const wanted = normalizeName(name);
  return [...candidates].sort((a, b) => score(b) - score(a));

  function score(c) {
    let s = 0;
    // A hint from the assistant ("Italy") is the strongest signal.
    if (countryCode && c.countryCode === countryCode) s += 100;
    // Prefer a match on the city's primary name over a translation alias.
    if (normalizeName(c.name) === wanted) s += 10;
    return s;
  }
}

/**
 * Resolves a city the assistant named. An explicit IATA code is trusted when it
 * exists in the index (or when the index is unavailable), otherwise the name is
 * matched and ranked.
 * @param {{name?:string, iata?:string, countryCode?:string}|string} query
 * @returns {Promise<{iata:string,name:string,country:string|null}|null>}
 */
async function resolveCity(query) {
  const q = typeof query === "string" ? { name: query } : query || {};
  const name = typeof q.name === "string" ? q.name.trim() : "";
  const iata = typeof q.iata === "string" && IATA_RE.test(q.iata.trim())
    ? q.iata.trim().toUpperCase()
    : null;
  if (!name && !iata) return null;

  const index = await getCityIndex();

  // Reference data unavailable: trust a well-formed code so the feature still
  // works. A wrong code simply returns no price and the route is dropped.
  if (!index) {
    return iata ? { iata, name: name || iata, country: q.country || null } : null;
  }

  if (iata) {
    const hit = index.byCode.get(iata);
    if (hit) return hit;
  }

  // A bare 3-letter name is probably a code.
  if (!iata && IATA_RE.test(name)) {
    const hit = index.byCode.get(name.toUpperCase());
    if (hit) return hit;
  }

  const candidates = index.byName.get(normalizeName(name));
  if (!candidates || candidates.length === 0) {
    return iata ? { iata, name: name || iata, country: q.country || null } : null;
  }
  return rankCandidates(candidates, { name, countryCode: q.countryCode })[0];
}

module.exports = {
  getFlightPrice,
  getFlightPrices,
  getCityDirections,
  getCityIndex,
  resolveCity,
  isConfigured,
  parseOffers,
  normalizeName,
};
