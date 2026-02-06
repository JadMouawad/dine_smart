const { Pool } = require("pg");
const config = require("./env");

const poolConfig = {};

if (config.db.connectionString) {
  poolConfig.connectionString = config.db.connectionString;
} else {
  poolConfig.host = config.db.host;
  poolConfig.port = config.db.port;
  poolConfig.user = config.db.user;
  poolConfig.password = config.db.password;
  poolConfig.database = config.db.database;
}

if (config.db.ssl) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  // Keep the process alive and log for visibility
  console.error("Unexpected PostgreSQL pool error:", err);
});

module.exports = pool;
