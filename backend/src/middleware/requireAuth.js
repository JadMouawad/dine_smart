const jwt = require("jsonwebtoken");
const tokenBlacklistRepository = require("../repositories/tokenBlacklistRepository");

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.jti) {
      const blacklisted = await tokenBlacklistRepository.isBlacklisted(decoded.jti);
      if (blacklisted) {
        return res.status(401).json({ message: "Token has been invalidated (logged out)" });
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = requireAuth;
