const dotenv = require("dotenv");

// Load environment variables from .env if present
dotenv.config();

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const isTrue = (value) => value === "true" || value === "1";

const config = {
  env: process.env.NODE_ENV || "development",
  port: toInt(process.env.PORT, 3000),
  db: {
    // Prefer a single connection string when available
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST || undefined,
    port: toInt(process.env.DB_PORT, 5432),
    user: process.env.DB_USER || undefined,
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME || undefined,
    ssl: isTrue(process.env.DB_SSL)
  }
};

module.exports = config;
