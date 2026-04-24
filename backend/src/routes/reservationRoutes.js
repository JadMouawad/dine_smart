const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const reservationController = require("../controllers/reservationController");

router.get("/disabled-slots", reservationController.getDisabledSlots);
router.get("/availability", reservationController.getAvailability);
router.get("/user/:id", requireAuth, reservationController.getReservationsByUser);
router.post("/waitlist", requireAuth, reservationController.joinWaitlist);
router.delete("/waitlist", requireAuth, reservationController.leaveWaitlist);
router.post("/", requireAuth, reservationController.createReservation);
router.patch("/:id", requireAuth, reservationController.updateReservation);
router.delete("/:id", requireAuth, reservationController.cancelReservation);

module.exports = router;