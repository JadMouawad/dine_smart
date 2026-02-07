const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");

// GET /api/me - Get current authenticated user
router.get("/me", requireAuth, (req, res) => {
  // User data is attached to req.user by the middleware
  res.json({
    message: "User profile retrieved",
    user: req.user
  });
});

module.exports = router;
