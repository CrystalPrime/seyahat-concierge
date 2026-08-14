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

const BASE_URL = process.env.TRAVELPAYOUTS_BASE_URL || "https://api.travelpayouts.com";
const TOKEN = process.env.TRAVELPAYOUTS_TOKEN || "";
const CURRENCY = process.env.TRAVELPAYOUTS_CURRENCY || "try";
const TIMEOUT_MS = Number(process.env.TRAVELPAYOUTS_TIMEOUT_MS) || 8000;
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
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
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
    const reason = e.name === "AbortError" ? `timeout (${TIMEOUT_MS}ms)` : e.message;
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

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS * 3);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadReferenceData() {
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

      const byCode = new Map();
      const byName = new Map();
      for (const c of Array.isArray(cities) ? cities : []) {
        if (!c?.code || !c?.name) continue;
        const entry = {
          iata: c.code,
          name: c.name,
          countryCode: c.country_code || null,
          country: c.country_code ? countryByCode.get(c.country_code) || null : null,
        };
        byCode.set(c.code, entry);

        // Reverse index so the assistant can name a city we have not cached.
        // Includes every translation the dump offers, so "Londra" resolves too.
        const aliases = [c.name, ...Object.values(c.name_translations || {})];
        for (const alias of aliases) {
          if (typeof alias !== "string" || !alias.trim()) continue;
          const key = normalizeName(alias);
          if (!byName.has(key)) byName.set(key, entry);
        }
      }

      if (byCode.size === 0) throw new Error("boş şehir listesi");
      console.log(
        `[travelpayouts] referans veri yüklendi (${locale}): ${byCode.size} şehir, ${byName.size} isim`
      );
      return { byCode, byName };
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

/**
 * Resolves a free-form city name or IATA code to a catalog-shaped city entry.
 * @returns {Promise<{iata:string,name:string,country:string|null}|null>}
 */
async function resolveCity(query) {
  if (typeof query !== "string" || !query.trim()) return null;
  const index = await getCityIndex();
  if (!index) return null;

  const raw = query.trim();
  if (/^[A-Za-z]{3}$/.test(raw)) {
    const byCode = index.byCode.get(raw.toUpperCase());
    if (byCode) return byCode;
  }
  return index.byName.get(normalizeName(raw)) || null;
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
