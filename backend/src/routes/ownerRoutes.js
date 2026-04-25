const express = require("express");
const router = express.Router();
const restaurantController = require("../controllers/restaurantController");
const reviewController = require("../controllers/reviewController");
const eventController = require("../controllers/eventController");
const reservationController = require("../controllers/reservationController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { requireApprovedRestaurant } = require("../middleware/ownerApprovalMiddleware");

router.get(
  "/restaurants/:id/table-config",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  restaurantController.getOwnerRestaurantTableConfig
);

router.post(
  "/restaurants/:id/table-config",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  restaurantController.upsertOwnerRestaurantTableConfig
);

router.post(
  "/events",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  eventController.createOwnerEvent
);

router.get(
  "/events",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  eventController.getOwnerEvents
);

router.get(
  "/events/:id/attendees",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  eventController.getOwnerEventAttendees
);

router.get(
  "/event-reservations",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  eventController.getOwnerEventReservations
);

router.delete(
  "/event-reservations/:id",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  eventController.deleteOwnerEventReservation
);

router.put(
  "/events/:id",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  eventController.updateOwnerEvent
);

router.delete(
  "/events/:id",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  eventController.deleteOwnerEvent
);

router.patch(
  "/events/:eventId/attendees/:attendeeId/no-show",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  eventController.markEventAttendeeNoShow
);

router.post(
  "/reviews/:id/respond",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  reviewController.respondToReviewAsOwner
);

router.get(
  "/reservations",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  reservationController.getReservationsForOwner
);

router.patch(
  "/reservations/:id/status",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  reservationController.updateReservationStatusForOwner
);

router.delete(
  "/reservations/:id",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  reservationController.deleteReservationForOwner
);

router.patch(
  "/reservations/:id/no-show",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  reservationController.markNoShow
);

router.get(
  "/restaurants/:id/slot-adjustments",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  reservationController.getSlotAdjustmentForOwner
);

router.post(
  "/restaurants/:id/slot-adjustments",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  reservationController.upsertSlotAdjustmentForOwner
);

router.get(
  "/restaurants/:id/disabled-slots",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  reservationController.getDisabledSlotsForOwner
);

router.post(
  "/restaurants/:id/disabled-slots",
  authenticateToken,
  authorizeRoles("owner"),
  requireApprovedRestaurant,
  reservationController.upsertDisabledSlotForOwner
);

module.exports = router;