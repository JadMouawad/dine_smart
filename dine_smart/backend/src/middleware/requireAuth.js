// Import jsonwebtoken to verify JWT tokens
const jwt = require("jsonwebtoken");

// Middleware function to protect routes
const requireAuth = (req, res, next) => {
  try {
    // 1️⃣ Get the Authorization header from the request
    // Format expected: "Bearer TOKEN"
    const authHeader = req.headers.authorization;

    // If no Authorization header exists, block access
    if (!authHeader) {
      return res.status(401).json({ message: "Authorization token required" });
    }

    // 2️⃣ Extract the token part only (remove "Bearer ")
    const token = authHeader.split(" ")[1];

    // 3️⃣ Verify the token using the secret key
    // If invalid or expired, jwt.verify will throw an error
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4️⃣ Attach decoded user info to the request
    // This allows future handlers to access req.user
    req.user = decoded;

    // 5️⃣ Token is valid → continue to the next middleware/controller
    next();
  } catch (error) {
    // Token invalid, expired, or malformed
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Export middleware so it can be used in routes
module.exports = requireAuth;
