// backend/src/services/reservationService.js
// Business logic for reservations and slot availability.

const crypto = require("crypto");
const db = require("../config/db");
const UserModel = require("../models/User");
const ReservationModel = require("../models/reservation.model");
const {
  sendReservationConfirmationEmail,
  sendReservationCancellationEmail,
  sendNoShowWarningEmail,
  sendNoShowBanEmail,
  sendWaitlistSlotAvailableEmail,
} = require("../utils/emailSender");

const MAX_PARTY_SIZE = 12;
const MIN_RESERVATION_MINUTES = 0;
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

const normalizeSeatingPreference = (value) => {
  if (value == null || String(value).trim() === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (!ALLOWED_SEATING_PREFERENCES.has(normalized)) return null;
  return normalized;
};

const toTimeValue = (minutes) => {
  const dayMinutes = 24 * 60;
  const normalized = ((minutes % dayMinutes) + dayMinutes) % dayMinutes;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
};

const withTransaction = async (callback) => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const createConfirmationId = () => {
  const chunk = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `DS-${chunk}`;
};

const formatDateForEmail = (value) => {
  const raw = String(value || "").trim();
  const dateOnly = raw.includes("T") ? raw.slice(0, 10) : raw;
  const parts = dateOnly.split("-").map((part) => parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return raw;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return raw;
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

const SUGGESTION_OFFSETS = [15, 30, 45, 60, 75, 90, -15, -30, -45, -60];

const getSuggestedTimes = async ({
  restaurantId,
  reservationDate,
  reservationTime,
  partySize,
  restaurant,
  totalCapacity,
}) => {
  const baseMinutes = parseTimeToMinutes(reservationTime);
  if (baseMinutes == null || !restaurant) return [];

  const suggestions = [];
  const seen = new Set();

  for (const offset of SUGGESTION_OFFSETS) {
    const candidateTime = toTimeValue(baseMinutes + offset);
    if (!isWithinOperatingHours(candidateTime, restaurant.opening_time, restaurant.closing_time)) {
      continue;
    }

    if (seen.has(candidateTime)) continue;
    seen.add(candidateTime);

    const bookedResult = await ReservationModel.getBookedSeatsForSlot(
      db,
      restaurantId,
      reservationDate,
      candidateTime
    );
    const bookedSeats = parseInt(bookedResult.rows[0]?.booked_seats, 10) || 0;
    const availableSeats = Math.max(totalCapacity - bookedSeats, 0);

    if (availableSeats >= partySize) {
      suggestions.push(candidateTime.slice(0, 5));
    }

    if (suggestions.length >= 3) break;
  }

  return suggestions;
};

const getSlotAvailability = async ({ restaurantId, reservationDate, reservationTime, seatingPreference = null }) => {
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

  const totalCapacityBase = buildCapacityFromConfig(tableConfig);
  const slotAdjustmentsResult = await ReservationModel.getSlotAdjustments(
    db,
    restaurantId,
    reservationDate,
    reservationTime
  );
  const slotAdjustments = (slotAdjustmentsResult.rows || []).reduce((acc, row) => {
    const key = String(row.seating_preference || "").toLowerCase();
    const value = parseInt(row.adjustment, 10);
    if (!Number.isNaN(value)) acc[key] = value;
    return acc;
  }, {});
  const anyAdjustment = slotAdjustments.any || 0;
  const indoorAdjustment = slotAdjustments.indoor || 0;
  const outdoorAdjustment = slotAdjustments.outdoor || 0;
  const indoorCapacityRaw = parseInt(tableConfig.indoor_capacity, 10);
  const outdoorCapacityRaw = parseInt(tableConfig.outdoor_capacity, 10);
  const indoorCapacityBase = Number.isFinite(indoorCapacityRaw) && indoorCapacityRaw > 0 ? indoorCapacityRaw : 0;
  const outdoorCapacityBase = Number.isFinite(outdoorCapacityRaw) && outdoorCapacityRaw > 0 ? outdoorCapacityRaw : 0;
  const hasSplitCapacity = indoorCapacityBase > 0 || outdoorCapacityBase > 0;
  const indoorCapacityAdjusted = Math.max(indoorCapacityBase + indoorAdjustment, 0);
  const outdoorCapacityAdjusted = Math.max(outdoorCapacityBase + outdoorAdjustment, 0);
  // When split capacity is defined, total = sum of adjusted indoor + outdoor + any.
  // When no split, total = table-based seats + all adjustments combined.
  const totalCapacity = hasSplitCapacity
    ? Math.max(indoorCapacityAdjusted + outdoorCapacityAdjusted + anyAdjustment, 0)
    : Math.max(totalCapacityBase + anyAdjustment + indoorAdjustment + outdoorAdjustment, 0);
  const totalAdjustment = totalCapacity - totalCapacityBase;
  const bookedResult = await ReservationModel.getBookedSeatsForSlot(
    db,
    restaurantId,
    reservationDate,
    reservationTime
  );
  const bookedSeats = parseInt(bookedResult.rows[0]?.booked_seats, 10) || 0;
  const availableSeats = Math.max(totalCapacity - bookedSeats, 0);

  const normalizedSeating = normalizeSeatingPreference(seatingPreference);
  let preferenceCapacity = null;
  let bookedSeatsPreference = null;
  let availableSeatsPreference = null;

  if (normalizedSeating) {
    if (hasSplitCapacity) {
      preferenceCapacity = normalizedSeating === "indoor"
        ? indoorCapacityAdjusted
        : outdoorCapacityAdjusted;
    } else {
      const specificPreferenceAdjustment = normalizedSeating === "indoor" ? indoorAdjustment : outdoorAdjustment;
      preferenceCapacity = Math.max(totalCapacityBase + anyAdjustment + specificPreferenceAdjustment, 0);
    }

    const slotReservationsResult = await ReservationModel.getReservationsForSlot(
      db,
      restaurantId,
      reservationDate,
      reservationTime
    );
    bookedSeatsPreference = (slotReservationsResult.rows || []).reduce((sum, reservation) => {
      const reservationPreference = String(reservation.seating_preference || "").toLowerCase();
      if (reservationPreference !== normalizedSeating) return sum;
      const reservationPartySize = parseInt(reservation.party_size, 10);
      return sum + (Number.isNaN(reservationPartySize) ? 0 : reservationPartySize);
    }, 0);
    availableSeatsPreference = Math.max(preferenceCapacity - bookedSeatsPreference, 0);
  }

  return {
    success: true,
    restaurant,
    anyAdjustment,
    totalAdjustment,
    totalCapacity,
    bookedSeats,
    availableSeats,
    preferenceCapacity,
    bookedSeatsPreference,
    availableSeatsPreference,
  };
};

const notifyWaitlistForSlot = async ({ restaurantId, reservationDate, reservationTime }) => {
  const availability = await getSlotAvailability({
    restaurantId,
    reservationDate,
    reservationTime,
  });

  if (!availability.success) {
    return { success: false, status: availability.status, error: availability.error };
  }

  let availableSeats = availability.availableSeats;
  if (availableSeats <= 0) {
    return { success: true, notifiedCount: 0 };
  }

  const waitlistResult = await ReservationModel.getWaitlistForSlot(db, {
    restaurantId,
    reservationDate,
    reservationTime,
  });
  const entries = waitlistResult.rows || [];
  if (entries.length === 0) {
    return { success: true, notifiedCount: 0 };
  }

  let notifiedCount = 0;
  for (const entry of entries) {
    const partySize = parseInt(entry.party_size, 10) || 1;
    if (partySize > availableSeats) {
      continue;
    }

    if (entry.email) {
      try {
        await sendWaitlistSlotAvailableEmail({
          to: entry.email,
          userName: entry.full_name || "Guest",
          restaurantName: availability.restaurant?.name || "the restaurant",
          reservationDate: formatDateForEmail(reservationDate),
          reservationTime: formatTimeForEmail(reservationTime),
          partySize,
          availableSeats,
        });
      } catch (error) {
        console.warn("Failed to send waitlist email:", error.message);
      }
    }

    await ReservationModel.markWaitlistNotified(db, entry.id);
    notifiedCount += 1;
    availableSeats = Math.max(availableSeats - partySize, 0);
    if (availableSeats <= 0) break;
  }

  return { success: true, notifiedCount };
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

  const lastReservationResult = await ReservationModel.getMostRecentReservationByUser(db, userId);
  const lastReservation = lastReservationResult.rows[0];
  if (lastReservation?.created_at) {
    const lastTime = new Date(lastReservation.created_at);
    const now = new Date();
    const diffMs = now.getTime() - lastTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 2) {
      return {
        success: false,
        status: 429,
        error: "You can book only once every 2 hours. Please try again later.",
      };
    }
  }

  if (!normalizedDate) {
    return { success: false, status: 400, error: "Reservation date is required" };
  }

  if (!normalizedTime) {
    return { success: false, status: 400, error: "Reservation time is required" };
  }

  const reservationMinutes = parseTimeToMinutes(normalizedTime);
  if (reservationMinutes == null || reservationMinutes < MIN_RESERVATION_MINUTES) {
    return { success: false, status: 400, error: "Reservation time must be 12:00 PM or later" };
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

  const normalizedSeating = normalizeSeatingPreference(seatingPreference);
  if (seatingPreference && !normalizedSeating) {
    return { success: false, status: 400, error: "Invalid seating preference" };
  }

  const availability = await getSlotAvailability({
    restaurantId: parsedRestaurantId,
    reservationDate: normalizedDate,
    reservationTime: normalizedTime,
    seatingPreference: normalizedSeating,
  });

  if (!availability.success) {
    return availability;
  }

  if (!isWithinOperatingHours(normalizedTime, availability.restaurant.opening_time, availability.restaurant.closing_time)) {
    return { success: false, status: 400, error: "Reservation time is outside restaurant operating hours" };
  }

  const availableSeatsForRequest =
    normalizedSeating && availability.availableSeatsPreference != null
      ? Math.min(availability.availableSeats, availability.availableSeatsPreference)
      : availability.availableSeats;

  if (availableSeatsForRequest < parsedPartySize) {
    const suggestedTimes = await getSuggestedTimes({
      restaurantId: parsedRestaurantId,
      reservationDate: normalizedDate,
      reservationTime: normalizedTime,
      partySize: parsedPartySize,
      restaurant: availability.restaurant,
      totalCapacity: availability.totalCapacity,
    });

    return {
      success: false,
      status: 409,
      error: normalizedSeating && availability.availableSeatsPreference != null
        ? `Only ${availableSeatsForRequest} ${normalizedSeating} seats available`
        : `Only ${availableSeatsForRequest} seats available`,
      availableSeats: availableSeatsForRequest,
      suggestedTimes,
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
        status: "pending",
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
    return { success: false, status: 409, error: "This time slot is already booked" };
  }

  // Confirmation email is sent after the restaurant accepts the reservation.

  try {
    await ReservationModel.cancelWaitlistEntryByUserAndSlot(db, {
      userId,
      restaurantId: parsedRestaurantId,
      reservationDate: normalizedDate,
      reservationTime: normalizedTime,
    });
  } catch (error) {
    console.warn("Failed to clear waitlist entry after booking:", error.message);
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

const getReservationsForOwner = async (ownerId) => {
  const parsedOwnerId = parseInt(ownerId, 10);
  if (Number.isNaN(parsedOwnerId)) {
    return { success: false, status: 400, error: "Invalid owner ID" };
  }

  const result = await ReservationModel.getOwnerReservations(db, parsedOwnerId);
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

  if (!["pending", "accepted", "confirmed"].includes(existingReservation.status)) {
    return { success: false, status: 409, error: `Reservation is already ${existingReservation.status}` };
  }

  const result = await ReservationModel.cancelReservation(db, parsedReservationId);
  const cancelled = result.rows[0];
  if (!cancelled) {
    return { success: false, status: 409, error: "Reservation could not be cancelled" };
  }

  const [reservationUser, restaurantResult] = await Promise.all([
    UserModel.findById(db, existingReservation.user_id),
    ReservationModel.getRestaurantById(db, existingReservation.restaurant_id),
  ]);
  const restaurant = restaurantResult.rows[0];

  if (reservationUser?.email && restaurant?.name) {
    try {
      await sendReservationCancellationEmail({
        to: reservationUser.email,
        userName: reservationUser.full_name || "Guest",
        restaurantName: restaurant.name,
        reservationDate: formatDateForEmail(existingReservation.reservation_date),
        reservationTime: formatTimeForEmail(existingReservation.reservation_time),
        partySize: existingReservation.party_size,
        confirmationId: existingReservation.confirmation_id,
      });
    } catch (error) {
      console.warn("Failed to send reservation cancellation email:", error.message);
    }
  }

  try {
    await notifyWaitlistForSlot({
      restaurantId: existingReservation.restaurant_id,
      reservationDate: existingReservation.reservation_date,
      reservationTime: existingReservation.reservation_time,
    });
  } catch (error) {
    console.warn("Failed to notify waitlist after cancellation:", error.message);
  }

  return { success: true, status: 200, reservation: cancelled };
};

const updateReservationStatusForOwner = async ({ reservationId, ownerId, action }) => {
  const parsedReservationId = parseInt(reservationId, 10);
  const parsedOwnerId = parseInt(ownerId, 10);
  const normalizedAction = String(action || "").trim().toLowerCase();

  if (Number.isNaN(parsedReservationId)) {
    return { success: false, status: 400, error: "Invalid reservation ID" };
  }
  if (Number.isNaN(parsedOwnerId)) {
    return { success: false, status: 400, error: "Invalid owner ID" };
  }
  if (!["accept", "reject", "complete"].includes(normalizedAction)) {
    return { success: false, status: 400, error: "Action must be accept, reject, or complete" };
  }

  const existingResult = await ReservationModel.getOwnerReservationById(db, {
    reservationId: parsedReservationId,
    ownerId: parsedOwnerId,
  });
  const existing = existingResult.rows[0];
  if (!existing) {
    return { success: false, status: 404, error: "Reservation not found" };
  }

  if (normalizedAction === "accept") {
    if (["cancelled", "rejected"].includes(existing.status)) {
      return { success: false, status: 409, error: `${existing.status} reservations cannot be accepted` };
    }
    if (["accepted", "confirmed"].includes(existing.status)) {
      return { success: true, status: 200, reservation: existing };
    }
  }

  if (normalizedAction === "reject") {
    if (existing.status === "cancelled") {
      return { success: true, status: 200, reservation: existing };
    }
    if (existing.status === "rejected") {
      return { success: true, status: 200, reservation: existing };
    }
  }

  if (normalizedAction === "complete") {
    if (existing.status === "completed") {
      return { success: true, status: 200, reservation: existing };
    }
    if (["cancelled", "rejected", "no-show"].includes(existing.status)) {
      return { success: false, status: 409, error: `${existing.status} reservations cannot be marked as completed` };
    }
    if (!["accepted", "confirmed"].includes(existing.status)) {
      return { success: false, status: 409, error: "Only accepted reservations can be marked as completed" };
    }
  }

  const nextStatus =
    normalizedAction === "accept"
      ? "accepted"
      : normalizedAction === "reject"
        ? "rejected"
        : "completed";
  const updatedResult = await ReservationModel.updateOwnerReservationStatus(db, {
    reservationId: parsedReservationId,
    ownerId: parsedOwnerId,
    status: nextStatus,
  });
  const updated = updatedResult.rows[0];
  if (!updated) {
    return { success: false, status: 409, error: "Reservation status could not be updated" };
  }

  if (nextStatus === "accepted") {
    try {
      const user = await UserModel.findById(db, updated.user_id);
      let restaurantName = updated.restaurant_name;
      let reservationDate = updated.reservation_date;
      let reservationTime = updated.reservation_time;
      let partySize = updated.party_size;
      let seatingPreference = updated.seating_preference;
      let specialRequest = updated.special_request;
      let confirmationId = updated.confirmation_id;

      if (!restaurantName || !reservationDate || !reservationTime || !partySize || !confirmationId) {
        const [reservationResult, restaurantResult] = await Promise.all([
          ReservationModel.getReservationById(db, updated.id),
          ReservationModel.getRestaurantById(db, updated.restaurant_id),
        ]);
        const reservationRow = reservationResult.rows[0] || {};
        const restaurantRow = restaurantResult.rows[0] || {};
        restaurantName = restaurantName || restaurantRow.name;
        reservationDate = reservationDate || reservationRow.reservation_date;
        reservationTime = reservationTime || reservationRow.reservation_time;
        partySize = partySize || reservationRow.party_size;
        seatingPreference = seatingPreference || reservationRow.seating_preference;
        specialRequest = specialRequest || reservationRow.special_request;
        confirmationId = confirmationId || reservationRow.confirmation_id;
      }

      if (user?.email) {
        await sendReservationConfirmationEmail({
          to: user.email,
          userName: user.full_name || "Guest",
          restaurantName: restaurantName || "the restaurant",
          reservationDate: formatDateForEmail(reservationDate),
          reservationTime: formatTimeForEmail(reservationTime),
          partySize,
          confirmationId,
          seatingPreference,
          specialRequest,
        });
      }
    } catch (error) {
      console.warn("Failed to send reservation confirmation email:", error.message);
    }
  }

  if (nextStatus === "rejected") {
    try {
      await notifyWaitlistForSlot({
        restaurantId: updated.restaurant_id,
        reservationDate: updated.reservation_date,
        reservationTime: updated.reservation_time,
      });
    } catch (error) {
      console.warn("Failed to notify waitlist after rejection:", error.message);
    }
  }

  return { success: true, status: 200, reservation: updated };
};

const deleteReservationForOwner = async ({ reservationId, ownerId }) => {
  const parsedReservationId = parseInt(reservationId, 10);
  const parsedOwnerId = parseInt(ownerId, 10);
  if (Number.isNaN(parsedReservationId)) {
    return { success: false, status: 400, error: "Invalid reservation ID" };
  }
  if (Number.isNaN(parsedOwnerId)) {
    return { success: false, status: 400, error: "Invalid owner ID" };
  }

  const existingResult = await ReservationModel.getOwnerReservationById(db, {
    reservationId: parsedReservationId,
    ownerId: parsedOwnerId,
  });
  const existing = existingResult.rows[0];
  if (!existing) {
    return { success: false, status: 404, error: "Reservation not found" };
  }

  const normalizedStatus = String(existing.status || "").toLowerCase();
  const isTerminal = ["cancelled", "completed", "no-show", "rejected"].includes(normalizedStatus);
  if (!isTerminal) {
    const datePart = String(existing.reservation_date || "").trim();
    const timePart = String(existing.reservation_time || "00:00:00").slice(0, 8);
    const endStamp = new Date(`${datePart}T${timePart}`);
    if (!Number.isNaN(endStamp.getTime()) && endStamp > new Date()) {
      return { success: false, status: 409, error: "Only past reservations can be deleted" };
    }
  }

  const deletedResult = await ReservationModel.deleteOwnerReservationById(db, {
    reservationId: parsedReservationId,
    ownerId: parsedOwnerId,
  });
  const deleted = deletedResult.rows[0];
  if (!deleted) {
    return { success: false, status: 409, error: "Reservation could not be deleted" };
  }

  return { success: true, status: 200, reservation: deleted };
};

const getSlotAdjustmentForOwner = async ({
  restaurantId,
  ownerId,
  reservationDate,
  reservationTime,
  seatingPreference,
}) => {
  const parsedRestaurantId = parseInt(restaurantId, 10);
  const parsedOwnerId = parseInt(ownerId, 10);
  const normalizedDate = String(reservationDate || "").trim();
  const normalizedTime = normalizeTime(reservationTime);
  const normalizedSeating = String(seatingPreference || "any").trim().toLowerCase() || "any";

  if (Number.isNaN(parsedRestaurantId)) {
    return { success: false, status: 400, error: "Invalid restaurant ID" };
  }
  if (Number.isNaN(parsedOwnerId)) {
    return { success: false, status: 400, error: "Invalid owner ID" };
  }
  if (!normalizedDate || !parseDateOnly(normalizedDate)) {
    return { success: false, status: 400, error: "Invalid reservation date" };
  }
  if (!normalizedTime) {
    return { success: false, status: 400, error: "Invalid reservation time" };
  }
  if (!["any", ...ALLOWED_SEATING_PREFERENCES].includes(normalizedSeating)) {
    return { success: false, status: 400, error: "Invalid seating preference" };
  }

  const restaurantResult = await ReservationModel.getRestaurantById(db, parsedRestaurantId);
  const restaurant = restaurantResult.rows[0];
  if (!restaurant || parseInt(restaurant.owner_id, 10) !== parsedOwnerId) {
    return { success: false, status: 404, error: "Restaurant not found" };
  }

  const adjustmentResult = await ReservationModel.getSlotAdjustment(
    db,
    parsedRestaurantId,
    normalizedDate,
    normalizedTime,
    normalizedSeating
  );
  const adjustment = adjustmentResult.rows[0];

  return {
    success: true,
    status: 200,
    adjustment: {
      restaurant_id: parsedRestaurantId,
      reservation_date: normalizedDate,
      reservation_time: normalizedTime,
      seating_preference: normalizedSeating,
      adjustment: parseInt(adjustment?.adjustment, 10) || 0,
    },
  };
};

const upsertSlotAdjustmentForOwner = async ({
  restaurantId,
  ownerId,
  reservationDate,
  reservationTime,
  seatingPreference,
  adjustment,
}) => {
  const parsedRestaurantId = parseInt(restaurantId, 10);
  const parsedOwnerId = parseInt(ownerId, 10);
  const parsedAdjustment = parseInt(adjustment, 10);
  const normalizedDate = String(reservationDate || "").trim();
  const normalizedTime = normalizeTime(reservationTime);
  const normalizedSeating = String(seatingPreference || "any").trim().toLowerCase() || "any";

  if (Number.isNaN(parsedRestaurantId)) {
    return { success: false, status: 400, error: "Invalid restaurant ID" };
  }
  if (Number.isNaN(parsedOwnerId)) {
    return { success: false, status: 400, error: "Invalid owner ID" };
  }
  if (!normalizedDate || !parseDateOnly(normalizedDate)) {
    return { success: false, status: 400, error: "Invalid reservation date" };
  }
  if (!normalizedTime) {
    return { success: false, status: 400, error: "Invalid reservation time" };
  }
  if (Number.isNaN(parsedAdjustment)) {
    return { success: false, status: 400, error: "Adjustment must be a valid number" };
  }
  if (!["any", ...ALLOWED_SEATING_PREFERENCES].includes(normalizedSeating)) {
    return { success: false, status: 400, error: "Invalid seating preference" };
  }

  const restaurantResult = await ReservationModel.getRestaurantById(db, parsedRestaurantId);
  const restaurant = restaurantResult.rows[0];
  if (!restaurant || parseInt(restaurant.owner_id, 10) !== parsedOwnerId) {
    return { success: false, status: 404, error: "Restaurant not found" };
  }

  const upsertResult = await ReservationModel.upsertSlotAdjustment(db, {
    restaurantId: parsedRestaurantId,
    reservationDate: normalizedDate,
    reservationTime: normalizedTime,
    seatingPreference: normalizedSeating,
    adjustment: parsedAdjustment,
  });
  const saved = upsertResult.rows[0];

  return { success: true, status: 200, adjustment: saved };
};

const getAvailability = async ({ restaurantId, reservationDate, reservationTime, partySize = null, seatingPreference = null }) => {
  const parsedRestaurantId = parseInt(restaurantId, 10);
  const normalizedDate = String(reservationDate || "").trim();
  const normalizedTime = normalizeTime(reservationTime);
  const parsedPartySize = partySize != null ? parseInt(partySize, 10) : 2;

  if (Number.isNaN(parsedRestaurantId)) {
    return { success: false, status: 400, error: "Invalid restaurant ID" };
  }
  if (!normalizedDate || !parseDateOnly(normalizedDate)) {
    return { success: false, status: 400, error: "Invalid reservation date" };
  }
  if (!normalizedTime) {
    return { success: false, status: 400, error: "Invalid reservation time" };
  }
  const requestedMinutes = parseTimeToMinutes(normalizedTime);
  if (requestedMinutes == null || requestedMinutes < MIN_RESERVATION_MINUTES) {
    return { success: false, status: 400, error: "Reservation time must be 12:00 PM or later" };
  }
  if (Number.isNaN(parsedPartySize) || parsedPartySize < 1) {
    return { success: false, status: 400, error: "Invalid party size" };
  }

  const normalizedSeating = normalizeSeatingPreference(seatingPreference);
  if (seatingPreference && !normalizedSeating) {
    return { success: false, status: 400, error: "Invalid seating preference" };
  }

  const availability = await getSlotAvailability({
    restaurantId: parsedRestaurantId,
    reservationDate: normalizedDate,
    reservationTime: normalizedTime,
    seatingPreference: normalizedSeating,
  });

  if (!availability.success) {
    return availability;
  }

  const withinOperatingHours = isWithinOperatingHours(
  normalizedTime,
  availability.restaurant.opening_time,
  availability.restaurant.closing_time
);

const availableSeatsForRequest =
  normalizedSeating && availability.availableSeatsPreference != null
    ? Math.min(availability.availableSeats, availability.availableSeatsPreference)
    : availability.availableSeats;

const lowCapacityThreshold = Math.max(2, Math.floor(availability.totalCapacity * 0.2));
const shouldSuggest =
  !withinOperatingHours ||
  availableSeatsForRequest <= lowCapacityThreshold ||
  availableSeatsForRequest < parsedPartySize;

const suggestedTimes = shouldSuggest
  ? await getSuggestedTimes({
      restaurantId: parsedRestaurantId,
      reservationDate: normalizedDate,
      reservationTime: normalizedTime,
      partySize: parsedPartySize,
      restaurant: availability.restaurant,
      totalCapacity: availability.totalCapacity,
    })
  : [];

return {
  success: true,
  status: 200,
  availability: {
    restaurant_id: parsedRestaurantId,
    reservation_date: normalizedDate,
    reservation_time: normalizedTime,
    requested_seating_preference: normalizedSeating,
    total_capacity: availability.totalCapacity,
    total_adjustment: availability.totalAdjustment ?? 0,
    booked_seats: availability.bookedSeats,
    available_seats_total: availability.availableSeats,
    preference_capacity: availability.preferenceCapacity,
    booked_seats_preference: availability.bookedSeatsPreference,
    available_seats_preference: availability.availableSeatsPreference,
    available_seats: availableSeatsForRequest,
    is_fully_booked: availableSeatsForRequest <= 0,
    is_outside_operating_hours: !withinOperatingHours,
    can_accommodate_party:
      withinOperatingHours && availableSeatsForRequest >= parsedPartySize,
    suggested_times: suggestedTimes,
  },
};
};

const joinWaitlist = async ({ userId, restaurantId, reservationDate, reservationTime, partySize }) => {
  const parsedRestaurantId = parseInt(restaurantId, 10);
  const parsedPartySize = parseInt(partySize, 10);
  const normalizedDate = String(reservationDate || "").trim();
  const normalizedTime = normalizeTime(reservationTime);

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

  if (availability.availableSeats >= parsedPartySize) {
    return {
      success: false,
      status: 409,
      error: "Seats are available right now. Please book instead of joining the waitlist.",
      availableSeats: availability.availableSeats,
    };
  }

  const result = await ReservationModel.upsertWaitlistEntry(db, {
    userId,
    restaurantId: parsedRestaurantId,
    reservationDate: normalizedDate,
    reservationTime: normalizedTime,
    partySize: parsedPartySize,
  });

  return { success: true, status: 201, waitlist: result.rows[0] };
};

const leaveWaitlist = async ({ userId, restaurantId, reservationDate, reservationTime }) => {
  const parsedRestaurantId = parseInt(restaurantId, 10);
  const normalizedDate = String(reservationDate || "").trim();
  const normalizedTime = normalizeTime(reservationTime);

  if (Number.isNaN(parsedRestaurantId)) {
    return { success: false, status: 400, error: "Invalid restaurant ID" };
  }
  if (!normalizedDate) {
    return { success: false, status: 400, error: "Reservation date is required" };
  }
  if (!normalizedTime) {
    return { success: false, status: 400, error: "Reservation time is required" };
  }

  const result = await ReservationModel.cancelWaitlistEntryByUserAndSlot(db, {
    userId,
    restaurantId: parsedRestaurantId,
    reservationDate: normalizedDate,
    reservationTime: normalizedTime,
  });

  const cancelled = result.rows[0];
  if (!cancelled) {
    return { success: false, status: 404, error: "Waitlist entry not found" };
  }

  return { success: true, status: 200, waitlist: cancelled };
};

const NO_SHOW_BAN_THRESHOLD = 3;
const NO_SHOW_BAN_DAYS = 30;

const markNoShow = async ({ reservationId, ownerId }) => {
  const parsedReservationId = parseInt(reservationId, 10);
  const parsedOwnerId = parseInt(ownerId, 10);

  if (Number.isNaN(parsedReservationId)) {
    return { success: false, status: 400, error: "Invalid reservation ID" };
  }

  const existingResult = await ReservationModel.getOwnerReservationById(db, {
    reservationId: parsedReservationId,
    ownerId: parsedOwnerId,
  });
  const existing = existingResult.rows[0];
  if (!existing) {
    return { success: false, status: 404, error: "Reservation not found" };
  }

  if (!["pending", "accepted", "confirmed"].includes(existing.status)) {
    return { success: false, status: 409, error: `Cannot mark a ${existing.status} reservation as no-show` };
  }

  return withTransaction(async (client) => {
    await client.query(
      `UPDATE reservations SET status = 'no-show', updated_at = NOW() WHERE id = $1`,
      [parsedReservationId]
    );

    const updatedUser = await UserModel.incrementNoShowCount(client, existing.user_id);
    const noShowCount = updatedUser?.no_show_count ?? 0;

    let bannedUntilLabel = null;
    if (noShowCount >= NO_SHOW_BAN_THRESHOLD) {
      const banDate = new Date();
      banDate.setDate(banDate.getDate() + NO_SHOW_BAN_DAYS);
      await UserModel.setBannedUntil(client, existing.user_id, banDate.toISOString().slice(0, 10));
      bannedUntilLabel = banDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    }

    const user = await UserModel.findById(db, existing.user_id);
    if (user?.email) {
      try {
        if (bannedUntilLabel) {
          await sendNoShowBanEmail({ to: user.email, userName: user.full_name || "Guest", bannedUntilLabel });
        } else if (noShowCount === NO_SHOW_BAN_THRESHOLD - 1) {
          await sendNoShowWarningEmail({ to: user.email, userName: user.full_name || "Guest" });
        }
      } catch (emailError) {
        console.warn("Failed to send no-show email:", emailError.message);
      }
    }

    return { success: true, status: 200, noShowCount, banned: !!bannedUntilLabel, bannedUntilLabel };
  });
};

module.exports = {
  createReservation,
  getReservationsForUser,
  getReservationsForOwner,
  cancelReservation,
  updateReservationStatusForOwner,
  deleteReservationForOwner,
  getSlotAdjustmentForOwner,
  upsertSlotAdjustmentForOwner,
  getAvailability,
  joinWaitlist,
  leaveWaitlist,
  markNoShow,
};
