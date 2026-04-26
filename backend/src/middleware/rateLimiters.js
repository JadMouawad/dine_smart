// backend/src/middleware/rateLimiters.js
// Rate limiters protect public auth endpoints from brute-force attacks,
// credential stuffing, and email/phone enumeration scraping.

const rateLimit = require("express-rate-limit");

// Strict limit for login / register / forgot-password / Google sign-in.
// 10 requests per 15 minutes per IP is generous for legitimate humans
// but kills automated brute-force scripts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});

// Looser limit for the phone-exists lookup. Legitimate signup uses it once
// or twice. Bots scraping the user base will hit this wall fast.
const phoneExistsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

// Rate limit for forgot-password specifically — separate so we can be
// stricter (prevents inbox flooding of a target user).
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset requests. Please try again later." },
});

module.exports = {
  authLimiter,
  phoneExistsLimiter,
  forgotPasswordLimiter,
};
