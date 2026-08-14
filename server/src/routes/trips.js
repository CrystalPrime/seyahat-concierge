const express = require("express");
const { nanoid } = require("nanoid");
const { readDb, writeDb } = require("../store");

const router = express.Router();

router.get("/", (req, res) => {
  const { status } = req.query;
  const db = readDb();
  let trips = db.trips;
  if (status) {
    trips = trips.filter((t) => t.status === status);
  }
  res.json({ trips });
});

router.get("/:id", (req, res) => {
  const db = readDb();
  const trip = db.trips.find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: "Seyahat bulunamadı" });
  res.json({ trip });
});

router.post("/", (req, res) => {
  const { destinationId, title, dateLabel, startDate, endDate, status, price, priceLabel, image } = req.body || {};
  if (!title || !dateLabel) {
    return res.status(400).json({ error: "title ve dateLabel zorunludur" });
  }
  const db = readDb();
  const trip = {
    id: `trip-${nanoid(8)}`,
    destinationId: destinationId || null,
    title,
    dateLabel,
    startDate: startDate || null,
    endDate: endDate || null,
    status: status || "draft",
    tripStatusLabel: status === "upcoming" ? "Planlama aşamasında" : "Taslak",
    price: price ?? null,
    priceLabel: priceLabel || "Henüz fiyatlanmadı",
    priceIsEstimate: Boolean(price),
    image: image || null,
  };
  db.trips.unshift(trip);
  writeDb(db);
  res.status(201).json({ trip });
});

router.patch("/:id", (req, res) => {
  const db = readDb();
  const idx = db.trips.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Seyahat bulunamadı" });
  db.trips[idx] = { ...db.trips[idx], ...req.body };
  writeDb(db);
  res.json({ trip: db.trips[idx] });
});

router.delete("/:id", (req, res) => {
  const db = readDb();
  const idx = db.trips.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Seyahat bulunamadı" });
  const [removed] = db.trips.splice(idx, 1);
  writeDb(db);
  res.json({ trip: removed });
});

module.exports = router;
