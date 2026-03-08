const express = require("express");
const routes = require("./routes");

const app = express();

// Enable CORS - Allow frontend to make requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Parse JSON bodies for API requests (allow image data URLs in payloads)
app.use(express.json({ limit: "12mb" }));

// Mount API routes under /api
app.use("/api", routes);

module.exports = app;
