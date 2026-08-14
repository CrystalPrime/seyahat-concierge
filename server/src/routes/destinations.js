const express = require("express");
const { destinations } = require("../data/destinations");
const { attachFlightFromPrices } = require("../pricing");

const router = express.Router();

router.get("/", async (req, res) => {
  const { season } = req.query;
  let items = destinations;
  if (season) {
    items = items.filter((d) => d.season.includes(season));
  }
  res.json({ destinations: await attachFlightFromPrices(items) });
});

router.get("/:id", async (req, res) => {
  const dest = destinations.find((d) => d.id === req.params.id);
  if (!dest) return res.status(404).json({ error: "Destinasyon bulunamadı" });
  const [withPrice] = await attachFlightFromPrices([dest]);
  res.json({ destination: withPrice });
});

module.exports = router;
