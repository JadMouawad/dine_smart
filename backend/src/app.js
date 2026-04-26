const express = require("express");
const routes = require("./routes");
const { isAllowedCorsOrigin } = require("./config/security");

const app = express();

// Enable CORS for configured frontend origins.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedCorsOrigin(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
  }
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return isAllowedCorsOrigin(origin) ? res.sendStatus(204) : res.sendStatus(403);
  }
  next();
});

// Parse JSON bodies for API requests (allow image data URLs in payloads)
app.use(express.json({ limit: "12mb" }));

// Mount API routes under /api
app.use("/api", routes);

module.exports = app;
