const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

router.post("/:id/flag", authenticateToken, authorizeRoles("user"), reviewController.flagReview);

module.exports = router;
