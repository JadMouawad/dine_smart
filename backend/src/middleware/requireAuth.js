const { verifyAuthorizationHeader } = require("../utils/authTokens");

const requireAuth = async (req, res, next) => {
  try {
    const verified = await verifyAuthorizationHeader(req.headers.authorization);
    if (!verified) {
      return res.status(401).json({ message: "Authorization token required" });
    }

    req.user = verified.decoded;
    next();
  } catch (error) {
    const message = error.code === "TOKEN_BLACKLISTED"
      ? error.message
      : "Invalid or expired token";
    return res.status(401).json({ message });
  }
};

module.exports = requireAuth;
