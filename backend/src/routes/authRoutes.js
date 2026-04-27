// backend/src/routes/authRoutes.js

const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const emailVerificationRoutes = require("./emailVerificationRoutes");
const requireAuth = require("../middleware/requireAuth");
const {
  authLimiter,
  phoneExistsLimiter,
  forgotPasswordLimiter,
} = require("../middleware/rateLimiters");

// Register route
router.post("/register", authLimiter, authController.register);

// Phone exists check (public) — separately rate-limited to prevent enumeration
router.get("/phone-exists", phoneExistsLimiter, authController.phoneExists);

// Login route
router.post("/login", authLimiter, authController.login);
router.post("/forgot-password", forgotPasswordLimiter, authController.requestPasswordReset);
router.post("/reset-password", authLimiter, authController.resetPassword);

// Google OAuth route
router.post("/google", authLimiter, authController.googleSignIn);

// Logout route (stateless - client removes token)
router.post("/logout", requireAuth, authController.logout);

// Email verification
router.use("/", emailVerificationRoutes);

module.exports = router;
