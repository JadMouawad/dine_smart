const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const profileController = require("../controllers/profileController");

router.get("/", requireAuth, profileController.getProfile);
router.put("/", requireAuth, profileController.updateProfile);

module.exports = router;
