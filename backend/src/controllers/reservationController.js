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
      voucherCode: req.body.voucher_code || req.body.voucherCode,
      durationMinutes: req.body.duration_minutes,
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

const getReservationsForOwner = async (req, res) => {
  try {
    const result = await reservationService.getReservationsForOwner(req.user.id);
    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }
    return res.status(200).json(result.reservations);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateReservation = async (req, res) => {
  try {
    const result = await reservationService.updateReservation({
      reservationId: req.params.id,
      requestingUserId: req.user.id,
      reservationDate: req.body.date,
      reservationTime: req.body.time,
      partySize: req.body.party_size,
      seatingPreference: req.body.seating_preference,
      specialRequest: req.body.special_request,
      durationMinutes: req.body.duration_minutes,
    });

    if (!result.success) {
      return res.status(result.status).json({
        message: result.error,
        ...(result.availableSeats != null ? { available_seats: result.availableSeats } : {}),
      });
    }

    return res.status(200).json(result.reservation);
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

const updateReservationStatusForOwner = async (req, res) => {
  try {
    const result = await reservationService.updateReservationStatusForOwner({
      reservationId: req.params.id,
      ownerId: req.user.id,
      action: req.body.action,
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(200).json(result.reservation);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


const getDisabledSlots = async (req, res) => {
  try {
    const result = await reservationService.getDisabledSlotsForRestaurant({
      restaurantId: req.query.restaurant_id,
      reservationDate: req.query.date,
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(200).json(result.disabledSlots);
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
      seatingPreference: req.query.seating_preference,
      durationMinutes: req.query.duration_minutes,
      excludeReservationId: req.query.exclude_reservation_id ?? null,
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(200).json(result.availability);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteReservationForOwner = async (req, res) => {
  try {
    const result = await reservationService.deleteReservationForOwner({
      reservationId: req.params.id,
      ownerId: req.user.id,
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(200).json(result.reservation);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const joinWaitlist = async (req, res) => {
  try {
    const result = await reservationService.joinWaitlist({
      userId: req.user.id,
      restaurantId: req.body.restaurant_id,
      reservationDate: req.body.date,
      reservationTime: req.body.time,
      partySize: req.body.party_size,
    });

    if (!result.success) {
      return res.status(result.status).json({
        message: result.error,
        ...(result.availableSeats != null ? { available_seats: result.availableSeats } : {}),
      });
    }

    return res.status(result.status).json(result.waitlist);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const leaveWaitlist = async (req, res) => {
  try {
    const result = await reservationService.leaveWaitlist({
      userId: req.user.id,
      restaurantId: req.body.restaurant_id,
      reservationDate: req.body.date,
      reservationTime: req.body.time,
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(result.status).json(result.waitlist);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


const getSlotAdjustmentForOwner = async (req, res) => {
  try {
    const result = await reservationService.getSlotAdjustmentForOwner({
      restaurantId: req.params.id,
      ownerId: req.user.id,
      reservationDate: req.query.date,
      reservationTime: req.query.time,
      seatingPreference: req.query.seating_preference,
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(200).json(result.adjustment);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const upsertSlotAdjustmentForOwner = async (req, res) => {
  try {
    const result = await reservationService.upsertSlotAdjustmentForOwner({
      restaurantId: req.params.id,
      ownerId: req.user.id,
      reservationDate: req.body.date,
      reservationTime: req.body.time,
      seatingPreference: req.body.seating_preference,
      adjustment: req.body.adjustment,
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(200).json(result.adjustment);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


const getDisabledSlotsForOwner = async (req, res) => {
  try {
    const result = await reservationService.getDisabledSlotsForOwner({
      restaurantId: req.params.id,
      ownerId: req.user.id,
      reservationDate: req.query.date,
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(200).json(result.disabledSlots);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const upsertDisabledSlotForOwner = async (req, res) => {
  try {
    const result = await reservationService.upsertDisabledSlotForOwner({
      restaurantId: req.params.id,
      ownerId: req.user.id,
      reservationDate: req.body.date,
      reservationTime: req.body.time,
      seatingPreference: req.body.seating_preference,
      reason: req.body.reason,
      disabled: req.body.disabled,
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(200).json(result.disabledSlot);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const markNoShow = async (req, res) => {
  try {
    const result = await reservationService.markNoShow({
      reservationId: req.params.id,
      ownerId: req.user.id,
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createReservation,
  updateReservation,
  getReservationsByUser,
  getReservationsForOwner,
  cancelReservation,
  updateReservationStatusForOwner,
  deleteReservationForOwner,
  getDisabledSlots,
  getAvailability,
  getSlotAdjustmentForOwner,
  upsertSlotAdjustmentForOwner,
  getDisabledSlotsForOwner,
  upsertDisabledSlotForOwner,
  markNoShow,
  joinWaitlist,
  leaveWaitlist,
};
