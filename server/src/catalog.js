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
const {
  getCityDirections,
  getCityIndex,
  resolveCity,
  isConfigured,
} = require("./providers/travelpayouts");

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
    .map((r) => buildDestination(r, cityIndex?.byCode.get(r.destination) || null))
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

/**
 * Turns free-form city names into catalog-shaped destinations, so the assistant
 * can propose somewhere outside the cached top-N routes (e.g. New York).
 * Names that cannot be resolved to an airport are dropped rather than guessed.
 * @param {string[]} queries
 */
async function resolveDestinations(queries) {
  if (!Array.isArray(queries) || queries.length === 0) return [];
  const catalog = await getCatalog();

  const resolved = await Promise.all(
    queries.slice(0, 5).map(async (raw) => {
      // Accepts both the {name, iata, country} objects the prompt asks for and
      // a plain string, so an older model output still works.
      const q =
        typeof raw === "string"
          ? { name: raw }
          : {
              name: typeof raw?.name === "string" ? raw.name : "",
              iata: typeof raw?.iata === "string" ? raw.iata : undefined,
              countryCode:
                typeof raw?.country === "string" && raw.country.length === 2
                  ? raw.country.toUpperCase()
                  : undefined,
            };

      const city = await resolveCity(q);
      if (!city) return null;

      const alreadyInCatalog = catalog.find((d) => d.iata === city.iata);
      if (alreadyInCatalog) return alreadyInCatalog;

      const known = curatedByIata.get(city.iata);
      return {
        id: known?.id || slugify(`${city.name}-${city.iata}`),
        name: known?.name || city.name,
        country: known?.country || city.country || "",
        iata: city.iata,
        tagline: known?.tagline || (city.country ? `${city.country} rotası` : "Seçtiğin rota"),
        tags: known?.tags || [],
        hotelPricePerNight: known?.hotelPricePerNight ?? DEFAULT_HOTEL_PRICE_PER_NIGHT,
        // No cached route price for these; pricing falls back to this only if
        // the live per-route lookup also fails, and the UI marks it estimated.
        fallbackFlightPrice: known?.fallbackFlightPrice ?? 0,
        currency: "TRY",
        directFlight: known?.directFlight ?? false,
        hotelStars: known?.hotelStars ?? DEFAULT_HOTEL_STARS,
        editorsPick: false,
        image: known?.image || `https://picsum.photos/seed/${city.iata.toLowerCase()}/900/700`,
        season: known?.season || [],
        isLive: true,
        offCatalog: true,
      };
    })
  );

  const seen = new Set();
  return resolved.filter((d) => d && !seen.has(d.iata) && seen.add(d.iata));
}

/**
 * Finds a destination by the id used in route cards. Ids generated for cities
 * outside the cached catalog carry their IATA code as the last segment
 * ("milan-mil"), so they can be rebuilt on demand — otherwise tapping such a
 * card would 404.
 */
async function findDestinationById(id) {
  if (typeof id !== "string" || !id) return null;

  const catalog = await getCatalog();
  const known = catalog.find((d) => d.id === id);
  if (known) return known;

  const tail = id.split("-").pop();
  if (!/^[a-z]{3}$/.test(tail || "")) return null;

  const [rebuilt] = await resolveDestinations([{ iata: tail.toUpperCase() }]);
  return rebuilt || null;
}

module.exports = {
  getCatalog,
  clearCatalogCache,
  resolveDestinations,
  findDestinationById,
  ORIGIN_IATA,
};
