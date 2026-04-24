const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const profileController = require("../controllers/profileController");

router.get("/", requireAuth, profileController.getProfile);
router.put("/", requireAuth, profileController.updateProfile);
router.delete("/", requireAuth, profileController.deleteAccount);
router.post("/rewards/redeem", requireAuth, profileController.redeemReward);

module.exports = router;
