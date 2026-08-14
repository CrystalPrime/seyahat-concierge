const { ORIGIN_IATA } = require("./data/destinations");
const { getFlightPrices, isConfigured } = require("./providers/travelpayouts");

const MONTH_NUMBERS = {
  ocak: "01", subat: "02", mart: "03", nisan: "04", mayis: "05", haziran: "06",
  temmuz: "07", agustos: "08", eylul: "09", ekim: "10", kasim: "11", aralik: "12",
};

const TR_MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function formatTry(amount) {
  return `₺${Math.round(amount).toLocaleString("tr-TR")}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Travelpayouts wants YYYY-MM. A bare month name is resolved against the next
// occurrence of that month so "mayıs" in December means next May, not last May.
function monthToDepartDate(month, now = new Date()) {
  const mm = MONTH_NUMBERS[month];
  if (!mm) return null;
  const year = Number(mm) >= now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
  return `${year}-${mm}`;
}

function nightsBetween(departDate, returnDate) {
  if (!isValidIsoDate(departDate) || !isValidIsoDate(returnDate)) return null;
  const ms = new Date(`${returnDate}T00:00:00Z`) - new Date(`${departDate}T00:00:00Z`);
  const nights = Math.round(ms / 86400000);
  return nights > 0 && nights <= 60 ? nights : null;
}

/** "16-18 Mayıs 2026" for a same-month range, otherwise a fuller label. */
function formatDateRange(departDate, returnDate) {
  if (!isValidIsoDate(departDate)) return null;
  const [dy, dm, dd] = departDate.split("-").map(Number);
  if (!isValidIsoDate(returnDate)) {
    return `${dd} ${TR_MONTH_NAMES[dm - 1]} ${dy}`;
  }
  const [ry, rm, rd] = returnDate.split("-").map(Number);
  if (dy === ry && dm === rm) {
    return `${dd}-${rd} ${TR_MONTH_NAMES[dm - 1]} ${dy}`;
  }
  if (dy === ry) {
    return `${dd} ${TR_MONTH_NAMES[dm - 1]} - ${rd} ${TR_MONTH_NAMES[rm - 1]} ${dy}`;
  }
  return `${dd} ${TR_MONTH_NAMES[dm - 1]} ${dy} - ${rd} ${TR_MONTH_NAMES[rm - 1]} ${ry}`;
}

/**
 * Resolves what to send to the flight API and how long the stay is.
 * Exact dates win; a bare month narrows the search to that month; otherwise the
 * provider returns the cheapest date it can find.
 */
function resolveTravelWindow({ departDate, returnDate, month, nights }) {
  const exactDepart = isValidIsoDate(departDate) ? departDate : null;
  const exactReturn = isValidIsoDate(returnDate) ? returnDate : null;
  const derivedNights = nightsBetween(exactDepart, exactReturn);

  return {
    departDate: exactDepart || (month ? monthToDepartDate(month) : null),
    returnDate: exactReturn,
    nights: derivedNights || nights || 2,
    dateLabel: formatDateRange(exactDepart, exactReturn),
    hasExactDates: Boolean(exactDepart),
  };
}

/**
 * Builds route objects with a real flight price when Travelpayouts can supply
 * one, falling back to the catalog estimate otherwise. Hotel cost is always an
 * estimate — no hotel API is connected.
 */
async function buildPricedRoutes(chosenDestinations, window) {
  const { departDate, returnDate, nights, dateLabel } = window;

  let liveByIata = {};
  if (isConfigured() && chosenDestinations.length) {
    liveByIata = await getFlightPrices({
      origin: ORIGIN_IATA,
      destinations: chosenDestinations.map((d) => d.iata),
      departDate,
      returnDate,
    });
  }

  return chosenDestinations
    .map((dest) => {
      const live = liveByIata[dest.iata] || null;
      const flightPrice = live ? live.cheapest.price : dest.fallbackFlightPrice;

      // An off-catalog city with no live price has nothing real to show, so it
      // is dropped rather than presented with an invented number.
      if (!flightPrice) return null;

      const hotelPrice = dest.hotelPricePerNight * nights;
      const total = Math.round(flightPrice + hotelPrice);

      return {
        destinationId: dest.id,
        name: dest.name,
        country: dest.country,
        tagline: dest.tagline,
        image: dest.image,
        nights,
        dateLabel,
        departDate: departDate && departDate.length === 10 ? departDate : null,
        returnDate: returnDate || null,
        price: total,
        priceLabel: formatTry(total),
        flightPrice: Math.round(flightPrice),
        flightPriceLabel: formatTry(flightPrice),
        hotelPrice: Math.round(hotelPrice),
        hotelPriceLabel: formatTry(hotelPrice),
        flightPriceSource: live ? "live" : "estimate",
        airline: live?.cheapest.airline || null,
        directFlight: live ? Boolean(live.direct) : dest.directFlight,
        directFlightPrice: live?.direct ? Math.round(live.direct.price) : null,
        hotelStars: dest.hotelStars,
      };
    })
    .filter(Boolean);
}

/** Cheapest live flight price per destination for the Discover screen. */
// A city resolved on the fly has no cached estimate, so when the live lookup
// also comes back empty there is no honest number to print.
function withFromPrice(dest, price, source) {
  if (!price) {
    return { ...dest, flightFromPrice: null, flightFromLabel: "Fiyat bulunamadı", flightPriceSource: "unavailable" };
  }
  return { ...dest, flightFromPrice: Math.round(price), flightFromLabel: formatTry(price), flightPriceSource: source };
}

async function attachFlightFromPrices(destinationList) {
  if (!isConfigured() || !destinationList.length) {
    return destinationList.map((d) => withFromPrice(d, d.fallbackFlightPrice, "estimate"));
  }

  const liveByIata = await getFlightPrices({
    origin: ORIGIN_IATA,
    destinations: destinationList.map((d) => d.iata),
  });

  return destinationList.map((d) => {
    const live = liveByIata[d.iata] || null;
    return live
      ? withFromPrice(d, live.cheapest.price, "live")
      : withFromPrice(d, d.fallbackFlightPrice, "estimate");
  });
}

module.exports = {
  buildPricedRoutes,
  attachFlightFromPrices,
  resolveTravelWindow,
  monthToDepartDate,
  formatDateRange,
  nightsBetween,
  isValidIsoDate,
  formatTry,
};
