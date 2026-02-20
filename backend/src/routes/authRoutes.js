// backend/src/routes/authRoutes.js

const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Register route
router.post("/register", authController.register);

// Login route
router.post("/login", authController.login);

// Google OAuth route
router.post("/google", authController.googleSignIn);

module.exports = router;
