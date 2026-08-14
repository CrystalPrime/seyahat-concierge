const express = require("express");
const { getCatalog, findDestinationById } = require("../catalog");
const { attachFlightFromPrices } = require("../pricing");

const router = express.Router();

router.get("/", async (req, res) => {
  const { season } = req.query;
  const catalog = await getCatalog();

  // Routes discovered from the flight API carry no season metadata. Applying a
  // season filter to them would silently drop every real destination and leave
  // only the hand-written ones, so the filter is for the curated fallback only.
  const isLive = catalog.some((d) => d.isLive);
  const list = season && !isLive ? catalog.filter((d) => d.season.includes(season)) : catalog;

  res.json({
    live: isLive,
    destinations: await attachFlightFromPrices(list.length ? list : catalog),
  });
});

router.get("/:id", async (req, res) => {
  const dest = await findDestinationById(req.params.id);
  if (!dest) return res.status(404).json({ error: "Destinasyon bulunamadı" });
  const [withPrice] = await attachFlightFromPrices([dest]);
  res.json({ destination: withPrice });
});

module.exports = router;
