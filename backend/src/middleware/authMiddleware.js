const { verifyAuthorizationHeader } = require("../utils/authTokens");

const authenticateToken = async (req, res, next) => {
  const verified = await verifyAuthorizationHeader(req.headers.authorization).catch((err) => {
    req.authError = err;
    return null;
  });

  if (!verified) {
    if (req.authError?.code === "TOKEN_BLACKLISTED") {
      return res.status(401).json({ message: req.authError.message });
    }
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.user = verified.decoded;
  next();
};

module.exports = { authenticateToken };
