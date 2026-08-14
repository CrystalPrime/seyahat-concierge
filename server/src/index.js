require("dotenv").config();

const express = require("express");
const cors = require("cors");

const destinationsRouter = require("./routes/destinations");
const conciergeRouter = require("./routes/concierge");
const tripsRouter = require("./routes/trips");
const { OLLAMA_BASE_URL, OLLAMA_MODEL } = require("./llm");
const { isConfigured: flightApiConfigured } = require("./providers/travelpayouts");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) =>
  res.json({
    ok: true,
    ollama: { baseUrl: OLLAMA_BASE_URL, model: OLLAMA_MODEL },
    flightApi: { provider: "travelpayouts", configured: flightApiConfigured() },
  })
);
app.use("/api/destinations", destinationsRouter);
app.use("/api/concierge", conciergeRouter);
app.use("/api/trips", tripsRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Travel concierge API listening on http://localhost:${PORT}`);
});
