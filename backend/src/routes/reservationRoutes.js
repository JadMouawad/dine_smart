const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const reservationController = require("../controllers/reservationController");

router.get("/availability", reservationController.getAvailability);
router.post("/", requireAuth, reservationController.createReservation);
router.get("/user/:id", requireAuth, reservationController.getReservationsByUser);
router.delete("/:id", requireAuth, reservationController.cancelReservation);

module.exports = router;

