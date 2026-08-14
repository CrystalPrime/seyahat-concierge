const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "trips.json");

const seedTrips = [
  {
    id: "trip-barcelona-getaway",
    destinationId: "barcelona",
    title: "Barcelona Getaway",
    dateLabel: "16-18 Mayıs 2025",
    startDate: "2025-05-16",
    endDate: "2025-05-18",
    status: "upcoming",
    tripStatusLabel: "Onaylandı",
    price: 11480,
    priceLabel: "₺11.480",
    priceIsEstimate: false,
    image: "https://picsum.photos/seed/barcelona/900/700",
  },
  {
    id: "trip-kapadokya-balon",
    destinationId: "kapadokya",
    title: "Kapadokya Balon Turu",
    dateLabel: "2-4 Haziran 2025",
    startDate: "2025-06-02",
    endDate: "2025-06-04",
    status: "upcoming",
    tripStatusLabel: "Planlama aşamasında",
    price: 7250,
    priceLabel: "₺7.250 (tahmini)",
    priceIsEstimate: true,
    image: "https://picsum.photos/seed/kapadokya/900/700",
  },
  {
    id: "trip-split-weekend",
    destinationId: "split",
    title: "Split Hafta Sonu Kaçamağı",
    dateLabel: "24-26 Mayıs 2025",
    startDate: "2025-05-24",
    endDate: "2025-05-26",
    status: "draft",
    tripStatusLabel: "Taslak",
    price: null,
    priceLabel: "Henüz fiyatlanmadı",
    priceIsEstimate: false,
    image: "https://picsum.photos/seed/split/900/700",
  },
];

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ trips: seedTrips }, null, 2));
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

module.exports = { readDb, writeDb };
