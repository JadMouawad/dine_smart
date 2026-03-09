const jwt = require("jsonwebtoken");
const tokenBlacklistRepository = require("../repositories/tokenBlacklistRepository");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

const extractToken = (authHeader) => {
  const raw = String(authHeader || "").trim();
  if (!raw) return null;

  const bearerMatch = raw.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch ? bearerMatch[1].trim() : raw;
  if (!token) return null;

  return token.replace(/^"+|"+$/g, "");
};

const authenticateToken = async (req, res, next) => {
  const token = extractToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.jti) {
      const blacklisted = await tokenBlacklistRepository.isBlacklisted(decoded.jti);
      if (blacklisted) {
        return res.status(401).json({ message: "Token has been invalidated (logged out)" });
      }
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

module.exports = { authenticateToken };
