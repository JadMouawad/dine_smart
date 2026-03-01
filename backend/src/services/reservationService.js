// backend/src/services/reservationService.js
// Business logic for reservations and slot availability.

const crypto = require("crypto");
const db = require("../config/db");
const UserModel = require("../models/User");
const ReservationModel = require("../models/reservation.model");
const { sendReservationConfirmationEmail } = require("../utils/emailSender");

const MAX_PARTY_SIZE = 12;
const ALLOWED_SEATING_PREFERENCES = new Set(["indoor", "outdoor"]);

const parseDateOnly = (value) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const parseTimeToMinutes = (value) => {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return (hours * 60) + minutes;
};

const normalizeTime = (value) => {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = match[1].padStart(2, "0");
  const minutes = match[2];
  return `${hours}:${minutes}:00`;
};

const isWithinOperatingHours = (reservationTime, openingTime, closingTime) => {
  const reservationMinutes = parseTimeToMinutes(reservationTime);
  if (reservationMinutes == null) return false;

  const openingMinutes = parseTimeToMinutes(openingTime);
  const closingMinutes = parseTimeToMinutes(closingTime);

  if (openingMinutes == null || closingMinutes == null) return true;

  if (openingMinutes <= closingMinutes) {
    return reservationMinutes >= openingMinutes && reservationMinutes <= closingMinutes;
  }

  return reservationMinutes >= openingMinutes || reservationMinutes <= closingMinutes;
};

const buildCapacityFromConfig = (tableConfig) => {
  const tableBasedCapacity =
    ((tableConfig.table_2_person || 0) * 2) +
    ((tableConfig.table_4_person || 0) * 4) +
    ((tableConfig.table_6_person || 0) * 6);

  if (tableBasedCapacity > 0) {
    return tableBasedCapacity;
  }

  return tableConfig.total_capacity || 0;
};

const createConfirmationId = () => {
  const chunk = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `DS-${chunk}`;
};

const formatDateForEmail = (value) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

const formatTimeForEmail = (value) => {
  const [hoursStr = "0", minutesStr = "00"] = String(value).split(":");
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;

  const normalizedHours = ((hours + 11) % 12) + 1;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${normalizedHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

const getSlotAvailability = async ({ restaurantId, reservationDate, reservationTime }) => {
  const restaurantResult = await ReservationModel.getRestaurantById(db, restaurantId);
  const restaurant = restaurantResult.rows[0];
  if (!restaurant) {
    return { success: false, status: 404, error: "Restaurant not found" };
  }

  if (!restaurant.is_verified || restaurant.approval_status !== "approved") {
    return { success: false, status: 403, error: "Restaurant is not accepting reservations yet" };
  }

  const configResult = await ReservationModel.getTableConfigByRestaurantId(db, restaurantId);
  const tableConfig = configResult.rows[0];
  if (!tableConfig) {
    return { success: false, status: 409, error: "Table configuration is not set for this restaurant" };
  }

  const totalCapacity = buildCapacityFromConfig(tableConfig);
  const bookedResult = await ReservationModel.getBookedSeatsForSlot(
    db,
    restaurantId,
    reservationDate,
    reservationTime
  );
  const bookedSeats = parseInt(bookedResult.rows[0]?.booked_seats, 10) || 0;
  const availableSeats = Math.max(totalCapacity - bookedSeats, 0);

  return {
    success: true,
    restaurant,
    totalCapacity,
    bookedSeats,
    availableSeats,
  };
};

const createReservation = async ({
  userId,
  restaurantId,
  reservationDate,
  reservationTime,
  partySize,
  seatingPreference,
  specialRequest,
}) => {
  const parsedRestaurantId = parseInt(restaurantId, 10);
  const parsedPartySize = parseInt(partySize, 10);
  const normalizedDate = String(reservationDate || "").trim();
  const normalizedTime = normalizeTime(reservationTime);
  const cleanedSpecialRequest = specialRequest != null ? String(specialRequest).trim() : null;

  if (Number.isNaN(parsedRestaurantId)) {
    return { success: false, status: 400, error: "Invalid restaurant ID" };
  }

  if (!normalizedDate) {
    return { success: false, status: 400, error: "Reservation date is required" };
  }

  if (!normalizedTime) {
    return { success: false, status: 400, error: "Reservation time is required" };
  }

  if (Number.isNaN(parsedPartySize) || parsedPartySize < 1 || parsedPartySize > MAX_PARTY_SIZE) {
    return { success: false, status: 400, error: `Party size must be between 1 and ${MAX_PARTY_SIZE}` };
  }

  const parsedDate = parseDateOnly(normalizedDate);
  if (!parsedDate) {
    return { success: false, status: 400, error: "Invalid reservation date" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsedDate < today) {
    return { success: false, status: 400, error: "Reservation date cannot be in the past" };
  }

  const normalizedSeating = seatingPreference ? String(seatingPreference).trim().toLowerCase() : null;
  if (normalizedSeating && !ALLOWED_SEATING_PREFERENCES.has(normalizedSeating)) {
    return { success: false, status: 400, error: "Invalid seating preference" };
  }

  const availability = await getSlotAvailability({
    restaurantId: parsedRestaurantId,
    reservationDate: normalizedDate,
    reservationTime: normalizedTime,
  });

  if (!availability.success) {
    return availability;
  }

  if (!isWithinOperatingHours(normalizedTime, availability.restaurant.opening_time, availability.restaurant.closing_time)) {
    return { success: false, status: 400, error: "Reservation time is outside restaurant operating hours" };
  }

  if (availability.availableSeats < parsedPartySize) {
    return {
      success: false,
      status: 409,
      error: `Only ${availability.availableSeats} seats available`,
      availableSeats: availability.availableSeats,
    };
  }

  let createdReservation = null;
  let confirmationId = null;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    confirmationId = createConfirmationId();
    try {
      const insertResult = await ReservationModel.createReservation(db, {
        userId,
        restaurantId: parsedRestaurantId,
        reservationDate: normalizedDate,
        reservationTime: normalizedTime,
        partySize: parsedPartySize,
        seatingPreference: normalizedSeating,
        specialRequest: cleanedSpecialRequest,
        confirmationId,
      });
      createdReservation = insertResult.rows[0];
      break;
    } catch (error) {
      // unique_violation for confirmation_id can happen in rare collisions
      if (error.code !== "23505") {
        throw error;
      }
    }
  }

  if (!createdReservation) {
    return { success: false, status: 500, error: "Failed to generate reservation confirmation ID" };
  }

  const user = await UserModel.findById(db, userId);
  if (user?.email) {
    try {
      await sendReservationConfirmationEmail({
        to: user.email,
        userName: user.full_name || "Guest",
        restaurantName: availability.restaurant.name,
        reservationDate: formatDateForEmail(normalizedDate),
        reservationTime: formatTimeForEmail(normalizedTime),
        partySize: parsedPartySize,
        confirmationId,
        seatingPreference: normalizedSeating,
        specialRequest: cleanedSpecialRequest,
      });
    } catch (error) {
      // Reservation should still succeed if email sending fails.
      console.warn("Failed to send reservation confirmation email:", error.message);
    }
  }

  return {
    success: true,
    status: 201,
    reservation: {
      ...createdReservation,
      restaurant_name: availability.restaurant.name,
    },
  };
};

const getReservationsForUser = async (requestedUserId) => {
  const parsedUserId = parseInt(requestedUserId, 10);
  if (Number.isNaN(parsedUserId)) {
    return { success: false, status: 400, error: "Invalid user ID" };
  }

  const result = await ReservationModel.getUserReservations(db, parsedUserId);
  return { success: true, status: 200, reservations: result.rows };
};

const cancelReservation = async ({ reservationId, requestingUserId, requestingUserRole }) => {
  const parsedReservationId = parseInt(reservationId, 10);
  if (Number.isNaN(parsedReservationId)) {
    return { success: false, status: 400, error: "Invalid reservation ID" };
  }

  const existingResult = await ReservationModel.getReservationById(db, parsedReservationId);
  const existingReservation = existingResult.rows[0];
  if (!existingReservation) {
    return { success: false, status: 404, error: "Reservation not found" };
  }

  const isOwner = existingReservation.user_id === parseInt(requestingUserId, 10);
  const isAdmin = requestingUserRole === "admin";
  if (!isOwner && !isAdmin) {
    return { success: false, status: 403, error: "You can only cancel your own reservation" };
  }

  if (existingReservation.status !== "confirmed") {
    return { success: false, status: 409, error: `Reservation is already ${existingReservation.status}` };
  }

  const result = await ReservationModel.cancelReservation(db, parsedReservationId);
  const cancelled = result.rows[0];
  if (!cancelled) {
    return { success: false, status: 409, error: "Reservation could not be cancelled" };
  }

  return { success: true, status: 200, reservation: cancelled };
};

const getAvailability = async ({ restaurantId, reservationDate, reservationTime }) => {
  const parsedRestaurantId = parseInt(restaurantId, 10);
  const normalizedDate = String(reservationDate || "").trim();
  const normalizedTime = normalizeTime(reservationTime);

  if (Number.isNaN(parsedRestaurantId)) {
    return { success: false, status: 400, error: "Invalid restaurant ID" };
  }
  if (!normalizedDate || !parseDateOnly(normalizedDate)) {
    return { success: false, status: 400, error: "Invalid reservation date" };
  }
  if (!normalizedTime) {
    return { success: false, status: 400, error: "Invalid reservation time" };
  }

  const availability = await getSlotAvailability({
    restaurantId: parsedRestaurantId,
    reservationDate: normalizedDate,
    reservationTime: normalizedTime,
  });

  if (!availability.success) {
    return availability;
  }

  return {
    success: true,
    status: 200,
    availability: {
      restaurant_id: parsedRestaurantId,
      reservation_date: normalizedDate,
      reservation_time: normalizedTime,
      total_capacity: availability.totalCapacity,
      booked_seats: availability.bookedSeats,
      available_seats: availability.availableSeats,
    },
  };
};

module.exports = {
  createReservation,
  getReservationsForUser,
  cancelReservation,
  getAvailability,
};

