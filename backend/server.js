const app = require("./src/app");
const config = require("./src/config/env");
const pool = require("./src/config/db");

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);

  // Test DB connection on startup so misconfiguration is immediately visible
  pool.query("SELECT 1").then(() => {
    console.log("✅ Database connected successfully");
  }).catch((err) => {
    console.error("❌ Database connection FAILED:", err.message);
    console.error("   Check your DATABASE_URL and DB_SSL settings in .env");
  });
});
