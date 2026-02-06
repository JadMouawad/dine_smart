const express = require("express");
const routes = require("./routes");

const app = express();

// Parse JSON bodies for API requests
app.use(express.json());

// Mount API routes under /api
app.use("/api", routes);

module.exports = app;
