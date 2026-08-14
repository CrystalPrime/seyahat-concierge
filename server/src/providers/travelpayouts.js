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
async function getFlightPrice({ origin, destination, departMonth }) {
  if (!isConfigured()) return null;

  const key = cacheKey(origin, destination, departMonth);
  const cached = readCache(key);
  if (cached !== undefined) return cached;

  const params = new URLSearchParams({ origin, destination, currency: CURRENCY });
  if (departMonth) params.set("depart_date", departMonth);

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
async function getFlightPrices({ origin, destinations, departMonth }) {
  const results = await Promise.all(
    destinations.map(async (destination) => [
      destination,
      await getFlightPrice({ origin, destination, departMonth }),
    ])
  );
  return Object.fromEntries(results);
}

module.exports = { getFlightPrice, getFlightPrices, isConfigured, parseOffers };
