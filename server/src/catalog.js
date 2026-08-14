// The destination catalog the rest of the app works against.
//
// When a Travelpayouts token is present the list is built from routes that are
// actually flown out of ORIGIN_IATA, with live prices. Curated entries in
// data/destinations.js are then used purely as *enrichment* (tagline, tags,
// season, hotel estimate) for the cities we happen to know something about;
// everything else gets neutral defaults.
//
// Without a token — or if the lookup fails — we fall back to the curated list
// so the app keeps working offline.

const { destinations: curated, ORIGIN_IATA } = require("./data/destinations");
const { getCityDirections, getCityIndex, isConfigured } = require("./providers/travelpayouts");

const MAX_DESTINATIONS = Number(process.env.CATALOG_SIZE) || 18;
const DEFAULT_HOTEL_PRICE_PER_NIGHT = Number(process.env.DEFAULT_HOTEL_PRICE) || 2800;
const DEFAULT_HOTEL_STARS = 4;
const CATALOG_TTL_MS = Number(process.env.CATALOG_TTL_MS) || 30 * 60 * 1000;

const curatedByIata = new Map(curated.map((d) => [d.iata, d]));

let cache = { value: null, expiresAt: 0 };

function slugify(text) {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildDestination(route, cityInfo) {
  const iata = route.destination;
  const known = curatedByIata.get(iata);
  const name = known?.name || cityInfo?.name || iata;
  const country = known?.country || cityInfo?.country || "";

  return {
    id: known?.id || slugify(`${name}-${iata}`),
    name,
    country,
    iata,
    tagline: known?.tagline || (country ? `${country} rotası` : "Popüler rota"),
    tags: known?.tags || [],
    hotelPricePerNight: known?.hotelPricePerNight ?? DEFAULT_HOTEL_PRICE_PER_NIGHT,
    // Live price for this route; also the fallback if a later per-route lookup fails.
    fallbackFlightPrice: Math.round(route.price),
    currency: "TRY",
    // transfers comes straight from the provider, so this is real availability.
    directFlight: route.transfers === null ? Boolean(known?.directFlight) : route.transfers === 0,
    hotelStars: known?.hotelStars ?? DEFAULT_HOTEL_STARS,
    editorsPick: false,
    image: known?.image || `https://picsum.photos/seed/${iata.toLowerCase()}/900/700`,
    // Real routes carry no season metadata; curated ones keep theirs so the
    // rule-based matcher can still score them.
    season: known?.season || [],
    airline: route.airline,
    transfers: route.transfers,
    isLive: true,
  };
}

async function buildLiveCatalog() {
  const routes = await getCityDirections({ origin: ORIGIN_IATA });
  if (!routes || routes.length === 0) return null;

  const cityIndex = await getCityIndex();

  const built = routes
    .filter((r) => r.destination && r.destination !== ORIGIN_IATA)
    .slice(0, MAX_DESTINATIONS)
    .map((r) => buildDestination(r, cityIndex?.get(r.destination) || null))
    // Drop entries we could not name at all — an "XYZ" card helps nobody.
    .filter((d) => d.name !== d.iata || d.country);

  if (built.length === 0) return null;

  // Give the Discover header something to feature.
  const featured = built.find((d) => curatedByIata.has(d.iata)) || built[0];
  featured.editorsPick = true;

  return built;
}

/** @returns {Promise<Array>} live catalog when available, curated list otherwise. */
async function getCatalog() {
  if (cache.value && Date.now() < cache.expiresAt) return cache.value;

  let value = null;
  if (isConfigured()) {
    try {
      value = await buildLiveCatalog();
    } catch (e) {
      console.warn(`[catalog] canlı katalog oluşturulamadı: ${e.message}`);
    }
  }

  if (!value) {
    value = curated.map((d) => ({ ...d, isLive: false }));
  }

  cache = { value, expiresAt: Date.now() + CATALOG_TTL_MS };
  return value;
}

function clearCatalogCache() {
  cache = { value: null, expiresAt: 0 };
}

module.exports = { getCatalog, clearCatalogCache, ORIGIN_IATA };
