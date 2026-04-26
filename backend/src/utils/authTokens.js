const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../config/security");
const tokenBlacklistRepository = require("../repositories/tokenBlacklistRepository");

const extractToken = (authHeader) => {
  const raw = String(authHeader || "").trim();
  if (!raw) return null;

  const bearerMatch = raw.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch ? bearerMatch[1].trim() : raw;
  if (!token) return null;

  return token.replace(/^"+|"+$/g, "");
};

const verifyToken = async (token) => {
  const decoded = jwt.verify(token, getJwtSecret());

  if (decoded.jti) {
    const blacklisted = await tokenBlacklistRepository.isBlacklisted(decoded.jti);
    if (blacklisted) {
      const error = new Error("Token has been invalidated (logged out)");
      error.code = "TOKEN_BLACKLISTED";
      throw error;
    }
  }

  return decoded;
};

const verifyAuthorizationHeader = async (authHeader) => {
  const token = extractToken(authHeader);
  if (!token) return null;
  const decoded = await verifyToken(token);
  return { token, decoded };
};

module.exports = {
  extractToken,
  verifyAuthorizationHeader,
  verifyToken,
};
