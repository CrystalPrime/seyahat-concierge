const express = require("express");
const { destinations } = require("../data/destinations");

const router = express.Router();

router.get("/", (req, res) => {
  const { season } = req.query;
  let items = destinations;
  if (season) {
    items = items.filter((d) => d.season.includes(season));
  }
  res.json({ destinations: items });
});

router.get("/:id", (req, res) => {
  const dest = destinations.find((d) => d.id === req.params.id);
  if (!dest) return res.status(404).json({ error: "Destinasyon bulunamadı" });
  res.json({ destination: dest });
});

module.exports = router;
