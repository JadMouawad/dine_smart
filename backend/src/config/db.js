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

// Auto-enable SSL for any remote (non-localhost) connection, or when DB_SSL=true
const isRemote = config.db.connectionString
  ? !config.db.connectionString.match(/localhost|127\.0\.0\.1/)
  : (config.db.host && !config.db.host.match(/localhost|127\.0\.0\.1/));

if (config.db.ssl || isRemote) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  // Keep the process alive and log for visibility
  console.error("Unexpected PostgreSQL pool error:", err);
});

module.exports = pool;
