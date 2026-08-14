const { ORIGIN_IATA } = require("./data/destinations");
const { getFlightPrices, isConfigured } = require("./providers/travelpayouts");

const MONTH_NUMBERS = {
  ocak: "01", subat: "02", mart: "03", nisan: "04", mayis: "05", haziran: "06",
  temmuz: "07", agustos: "08", eylul: "09", ekim: "10", kasim: "11", aralik: "12",
};

function formatTry(amount) {
  return `₺${Math.round(amount).toLocaleString("tr-TR")}`;
}

// Travelpayouts wants YYYY-MM. A bare month name is resolved against the next
// occurrence of that month so "mayıs" in December means next May, not last May.
function monthToDepartDate(month, now = new Date()) {
  const mm = MONTH_NUMBERS[month];
  if (!mm) return null;
  const year = Number(mm) >= now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
  return `${year}-${mm}`;
}

/**
 * Builds route objects with a real flight price when Travelpayouts can supply
 * one, falling back to the catalog estimate otherwise. Hotel cost is always an
 * estimate — no hotel API is connected.
 */
async function buildPricedRoutes(chosenDestinations, nights, month) {
  const departDate = month ? monthToDepartDate(month) : null;

  let liveByIata = {};
  if (isConfigured() && chosenDestinations.length) {
    liveByIata = await getFlightPrices({
      origin: ORIGIN_IATA,
      destinations: chosenDestinations.map((d) => d.iata),
      departMonth: departDate,
    });
  }

  return chosenDestinations.map((dest) => {
    const live = liveByIata[dest.iata] || null;
    const flightPrice = live ? live.cheapest.price : dest.fallbackFlightPrice;
    const hotelPrice = dest.hotelPricePerNight * nights;
    const total = Math.round(flightPrice + hotelPrice);

    return {
      destinationId: dest.id,
      name: dest.name,
      country: dest.country,
      tagline: dest.tagline,
      image: dest.image,
      nights,
      price: total,
      priceLabel: formatTry(total),
      flightPrice: Math.round(flightPrice),
      flightPriceLabel: formatTry(flightPrice),
      hotelPrice: Math.round(hotelPrice),
      hotelPriceLabel: formatTry(hotelPrice),
      // "live" = flight leg came from Travelpayouts; hotel leg is always an estimate.
      flightPriceSource: live ? "live" : "estimate",
      airline: live?.cheapest.airline || null,
      // Real non-stop availability when the provider reports it; otherwise the
      // catalog's static hint.
      directFlight: live ? Boolean(live.direct) : dest.directFlight,
      directFlightPrice: live?.direct ? Math.round(live.direct.price) : null,
      hotelStars: dest.hotelStars,
    };
  });
}

/** Cheapest live flight price per destination for the Discover screen. */
async function attachFlightFromPrices(destinationList) {
  if (!isConfigured() || !destinationList.length) {
    return destinationList.map((d) => ({
      ...d,
      flightFromPrice: d.fallbackFlightPrice,
      flightFromLabel: formatTry(d.fallbackFlightPrice),
      flightPriceSource: "estimate",
    }));
  }

  const liveByIata = await getFlightPrices({
    origin: ORIGIN_IATA,
    destinations: destinationList.map((d) => d.iata),
  });

  return destinationList.map((d) => {
    const live = liveByIata[d.iata] || null;
    const price = live ? live.cheapest.price : d.fallbackFlightPrice;
    return {
      ...d,
      flightFromPrice: Math.round(price),
      flightFromLabel: formatTry(price),
      flightPriceSource: live ? "live" : "estimate",
    };
  });
}

module.exports = { buildPricedRoutes, attachFlightFromPrices, monthToDepartDate, formatTry };
