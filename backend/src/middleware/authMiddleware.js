const jwt = require("jsonwebtoken");
const tokenBlacklistRepository = require("../repositories/tokenBlacklistRepository");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

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
