// backend/src/controllers/reservationController.js
// Handles HTTP requests for reservations.

const reservationService = require("../services/reservationService");

const createReservation = async (req, res) => {
  try {
    const result = await reservationService.createReservation({
      userId: req.user.id,
      restaurantId: req.body.restaurant_id,
      reservationDate: req.body.date,
      reservationTime: req.body.time,
      partySize: req.body.party_size,
      seatingPreference: req.body.seating_preference,
      specialRequest: req.body.special_request,
    });

    if (!result.success) {
      return res.status(result.status).json({
        message: result.error,
        ...(result.availableSeats != null ? { available_seats: result.availableSeats } : {}),
        ...(Array.isArray(result.suggestedTimes) && result.suggestedTimes.length > 0
          ? { suggested_times: result.suggestedTimes }
          : {}),
      });
    }

    return res.status(result.status).json(result.reservation);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getReservationsByUser = async (req, res) => {
  try {
    const requestedUserId = parseInt(req.params.id, 10);
    if (Number.isNaN(requestedUserId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const isOwner = requestedUserId === parseInt(req.user.id, 10);
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await reservationService.getReservationsForUser(requestedUserId);
    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(200).json(result.reservations);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const cancelReservation = async (req, res) => {
  try {
    const result = await reservationService.cancelReservation({
      reservationId: req.params.id,
      requestingUserId: req.user.id,
      requestingUserRole: req.user.role,
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(200).json(result.reservation);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getAvailability = async (req, res) => {
  try {
    const result = await reservationService.getAvailability({
      restaurantId: req.query.restaurant_id,
      reservationDate: req.query.date,
      reservationTime: req.query.time,
      partySize: req.query.party_size,
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(200).json(result.availability);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createReservation,
  getReservationsByUser,
  cancelReservation,
  getAvailability,
};
