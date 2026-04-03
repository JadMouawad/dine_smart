const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

router.get("/", eventController.getPublicEvents);
router.get("/saved", authenticateToken, authorizeRoles("user"), eventController.getSavedEvents);
router.post("/:id/join", authenticateToken, authorizeRoles("user"), eventController.joinEvent);
router.post("/:id/save", authenticateToken, authorizeRoles("user"), eventController.saveEvent);
router.delete("/:id/save", authenticateToken, authorizeRoles("user"), eventController.unsaveEvent);

module.exports = router;
