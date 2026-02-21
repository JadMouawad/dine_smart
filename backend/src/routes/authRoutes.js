// backend/src/routes/authRoutes.js

const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const emailVerificationRoutes = require("./emailVerificationRoutes");
const requireAuth = require("../middleware/requireAuth");

// Register route
router.post("/register", authController.register);

// Login route
router.post("/login", authController.login);

// Google OAuth route
router.post("/google", authController.googleSignIn);

// Logout route (stateless - client removes token)
router.post("/logout", requireAuth, authController.logout);

// Email verification
router.use("/", emailVerificationRoutes);

module.exports = router;
