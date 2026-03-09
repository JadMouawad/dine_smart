// backend/src/routes/user.routes.js

const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");

// GET /api/me - Get current authenticated user
router.get("/me", requireAuth, (req, res) => {
  res.json({
    message: "User profile retrieved",
    user: req.user
  });
});

module.exports = router;
