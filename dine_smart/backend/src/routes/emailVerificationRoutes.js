const express = require("express");
const router = express.Router();
const emailVerificationController = require("../controllers/emailVerificationController");

router.get("/verify-email", emailVerificationController.verifyEmail);

module.exports = router;
