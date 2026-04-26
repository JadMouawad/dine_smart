const config = require("./env");

const DEFAULT_DEV_JWT_SECRET = "dinesmart-local-dev-secret-change-me";

const splitCsv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const isProduction = () => config.env === "production";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim()) return secret.trim();

  if (isProduction()) {
    throw new Error("JWT_SECRET is required in production");
  }

  return DEFAULT_DEV_JWT_SECRET;
};

const getCorsOrigins = () => {
  const configured = splitCsv(process.env.CORS_ORIGINS);
  if (configured.length > 0) return configured;

  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl && frontendUrl.trim()) return [frontendUrl.trim()];

  return isProduction()
    ? []
    : ["http://localhost:5173", "http://127.0.0.1:5173"];
};

const isAllowedCorsOrigin = (origin) => {
  if (!origin) return true;
  return getCorsOrigins().includes(origin);
};

module.exports = {
  getCorsOrigins,
  getJwtSecret,
  isAllowedCorsOrigin,
};
