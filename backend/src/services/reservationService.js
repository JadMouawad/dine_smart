// backend/src/services/reservationService.js
// Business logic for reservations and slot availability.

const crypto = require("crypto");
const db = require("../config/db");
const UserModel = require("../models/User");
const ReservationModel = require("../models/reservation.model");
const restaurantService = require("./restaurantService");
const {
  sendReservationConfirmationEmail,
  sendReservationCancellationEmail,
  sendNoShowWarningEmail,
  sendNoShowBanEmail,
} = require("../utils/emailSender");

const MAX_PARTY_SIZE = 12;
const MIN_RESERVATION_MINUTES = 0;
const ALLOWED_SEATING_PREFERENCES = new Set(["indoor", "outdoor"]);
const ALLOWED_ADJUSTMENT_PREFERENCES = new Set(["any", "indoor", "outdoor"]);
const MAX_ADJUSTMENT = 200;

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

const normalizeSeatingPreference = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  return ALLOWED_SEATING_PREFERENCES.has(normalized) ? normalized : null;
};

const normalizeAdjustmentPreference = (value) => {
  if (!value) return "any";
  const normalized = String(value).trim().toLowerCase();
  return ALLOWED_ADJUSTMENT_PREFERENCES.has(normalized) ? normalized : null;
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

const buildTableCounts = (tableConfig) => ({
  seats2: Math.max(0, parseInt(tableConfig.table_2_person, 10) || 0),
  seats4: Math.max(0, parseInt(tableConfig.table_4_person, 10) || 0),
  seats6: Math.max(0, parseInt(tableConfig.table_6_person, 10) || 0),
});

const buildAvailableCombinations = (partySize, counts) => {
  const combos = [];
  const max6 = Math.min(counts.seats6, Math.ceil(partySize / 6));
  const max4 = Math.min(counts.seats4, Math.ceil(partySize / 4) + 2);
  const max2 = Math.min(counts.seats2, Math.ceil(partySize / 2) + 2);

  for (let c6 = 0; c6 <= max6; c6 += 1) {
    for (let c4 = 0; c4 <= max4; c4 += 1) {
      for (let c2 = 0; c2 <= max2; c2 += 1) {
        if (c6 === 0 && c4 === 0 && c2 === 0) continue;
        if (c6 > counts.seats6 || c4 > counts.seats4 || c2 > counts.seats2) continue;
        const seats = (c6 * 6) + (c4 * 4) + (c2 * 2);
        if (seats < partySize) continue;
        const tables = c6 + c4 + c2;
        combos.push({ c6, c4, c2, seats, tables });
      }
    }
  }

  combos.sort((a, b) => {
    if (a.seats !== b.seats) return a.seats - b.seats;
    return a.tables - b.tables;
  });

  return combos;
};

const canSeatPartiesWithTables = (parties, counts) => {
  if (!parties.length) return true;

  const totalAvailableSeats = (counts.seats2 * 2) + (counts.seats4 * 4) + (counts.seats6 * 6);
  const totalPartySeats = parties.reduce((sum, size) => sum + size, 0);
  if (totalPartySeats > totalAvailableSeats) return false;

  const sortedParties = [...parties].sort((a, b) => b - a);
  const memo = new Map();

  const dfs = (index, available) => {
    if (index >= sortedParties.length) return true;
    const key = `${index}-${available.seats2}-${available.seats4}-${available.seats6}`;
    if (memo.has(key)) return memo.get(key);

    const size = sortedParties[index];
    const combos = buildAvailableCombinations(size, available);
    for (const combo of combos) {
      const next = {
        seats2: available.seats2 - combo.c2,
        seats4: available.seats4 - combo.c4,
        seats6: available.seats6 - combo.c6,
      };
      if (next.seats2 < 0 || next.seats4 < 0 || next.seats6 < 0) continue;
      if (dfs(index + 1, next)) {
        memo.set(key, true);
        return true;
      }
    }

    memo.set(key, false);
    return false;
  };

  return dfs(0, counts);
};

const toTimeValue = (minutes) => {
  const dayMinutes = 24 * 60;
  const normalized = ((minutes % dayMinutes) + dayMinutes) % dayMinutes;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
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
  baseCapacity,
  seatingPreference,
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

    const availability = await getSlotAvailability({
      restaurantId,
      reservationDate,
      reservationTime: candidateTime,
      partySize,
      seatingPreference,
      restaurantOverride: restaurant,
      totalCapacityOverride: baseCapacity,
    });

    if (availability.success && availability.canAccommodateParty) {
      suggestions.push(candidateTime.slice(0, 5));
    }

    if (suggestions.length >= 3) break;
  }

  return suggestions;
};

const getSlotAvailability = async ({
  restaurantId,
  reservationDate,
  reservationTime,
  partySize = null,
  seatingPreference = null,
  restaurantOverride = null,
  totalCapacityOverride = null,
  dbClient = db,
}) => {
  const restaurantResult = restaurantOverride
    ? { rows: [restaurantOverride] }
    : await ReservationModel.getRestaurantById(dbClient, restaurantId);
  const restaurant = restaurantResult.rows[0];
  if (!restaurant) {
    return { success: false, status: 404, error: "Restaurant not found" };
  }

  if (!restaurant.is_verified || restaurant.approval_status !== "approved") {
    return { success: false, status: 403, error: "Restaurant is not accepting reservations yet" };
  }

  const configResult = await ReservationModel.getTableConfigByRestaurantId(dbClient, restaurantId);
  const tableConfig = configResult.rows[0];
  if (!tableConfig) {
    return { success: false, status: 409, error: "Table configuration is not set for this restaurant" };
  }

  const baseCapacity = totalCapacityOverride ?? buildCapacityFromConfig(tableConfig);
  const tableCounts = buildTableCounts(tableConfig);
  const hasTableConfig = (tableCounts.seats2 + tableCounts.seats4 + tableCounts.seats6) > 0;

  const reservationsResult = await ReservationModel.getReservationsForSlot(
    dbClient,
    restaurantId,
    reservationDate,
    reservationTime
  );

  const adjustmentResult = await ReservationModel.getSlotAdjustments(
    dbClient,
    restaurantId,
    reservationDate,
    reservationTime
  );

  const adjustments = { any: 0, indoor: 0, outdoor: 0 };
  adjustmentResult.rows.forEach((row) => {
    const pref = String(row.seating_preference || "any").toLowerCase();
    if (adjustments[pref] != null) {
      adjustments[pref] = parseInt(row.adjustment, 10) || 0;
    }
  });

  let bookedSeats = 0;
  const bookedByPreference = { indoor: 0, outdoor: 0 };
  const parties = [];

  reservationsResult.rows.forEach((reservation) => {
    const size = parseInt(reservation.party_size, 10) || 0;
    if (size <= 0) return;
    bookedSeats += size;
    parties.push(size);

    const pref = String(reservation.seating_preference || "").trim().toLowerCase();
    if (pref === "indoor" || pref === "outdoor") {
      bookedByPreference[pref] += size;
    }
  });

  const totalCapacityAdjusted = Math.max(0, baseCapacity + adjustments.any);
  const normalizedSeating = normalizeSeatingPreference(seatingPreference);

  let preferenceCapacityBase = baseCapacity;
  if (normalizedSeating === "indoor") {
    preferenceCapacityBase = tableConfig.indoor_capacity || 0;
  } else if (normalizedSeating === "outdoor") {
    preferenceCapacityBase = tableConfig.outdoor_capacity || 0;
  }
  if (preferenceCapacityBase <= 0) preferenceCapacityBase = baseCapacity;

  const preferenceCapacityAdjusted = Math.min(
    totalCapacityAdjusted,
    Math.max(0, preferenceCapacityBase + (normalizedSeating ? adjustments[normalizedSeating] : 0))
  );

  const availableSeats = Math.max(totalCapacityAdjusted - bookedSeats, 0);
  const availablePreferenceSeats = normalizedSeating
    ? Math.max(preferenceCapacityAdjusted - (bookedByPreference[normalizedSeating] || 0), 0)
    : availableSeats;

  const canFitTables = hasTableConfig
    ? canSeatPartiesWithTables(
      partySize != null ? [...parties, partySize] : parties,
      tableCounts
    )
    : true;

  const canAccommodateParty = partySize == null
    ? availableSeats > 0
    : (
      availableSeats >= partySize
      && (!normalizedSeating || availablePreferenceSeats >= partySize)
      && canFitTables
    );

  return {
    success: true,
    restaurant,
    baseCapacity,
    totalCapacity: totalCapacityAdjusted,
    bookedSeats,
    availableSeats,
    preferenceCapacity: normalizedSeating ? preferenceCapacityAdjusted : null,
    bookedSeatsPreference: normalizedSeating ? (bookedByPreference[normalizedSeating] || 0) : null,
    availableSeatsPreference: normalizedSeating ? availablePreferenceSeats : null,
    hasTableConfig,
    canFitTables,
    canAccommodateParty,
  };
};

const toDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const isBanActive = (bannedUntil) => {
  const bannedDate = toDateOnly(bannedUntil);
  if (!bannedDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return bannedDate >= today;
};

const addOneMonth = (baseDate = new Date()) => {
  const next = new Date(baseDate);
  next.setMonth(next.getMonth() + 1);
  return next;
};

const formatBanDateLabel = (date) => (
  date
    ? date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "a later date"
);

const buildSlotLockKey = ({ restaurantId, reservationDate, reservationTime }) => (
  `reservation-slot:${restaurantId}:${reservationDate}:${reservationTime}`
);

const buildUserDayLockKey = ({ userId, reservationDate }) => (
  `reservation-user-day:${userId}:${reservationDate}`
);

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

  const reservationMinutes = parseTimeToMinutes(normalizedTime);
  if (reservationMinutes == null || reservationMinutes < MIN_RESERVATION_MINUTES) {
    return { success: false, status: 400, error: "Invalid reservation time" };
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

  const user = await UserModel.findById(db, userId);
  if (!user) {
    return { success: false, status: 404, error: "User not found" };
  }
  if (user.banned_until && !isBanActive(user.banned_until)) {
    await UserModel.clearBan(db, user.id);
  }
  if (user.no_show_count >= 3 && !user.banned_until) {
    const banUntil = addOneMonth();
    await UserModel.setBannedUntil(db, user.id, banUntil);
    const label = formatBanDateLabel(banUntil);
    return { success: false, status: 403, error: `You are temporarily banned from booking until ${label} due to multiple no-shows.` };
  }
  if (isBanActive(user.banned_until)) {
    const label = formatBanDateLabel(toDateOnly(user.banned_until));
    return { success: false, status: 403, error: `You are temporarily banned from booking until ${label} due to multiple no-shows.` };
  }

  let createdReservation = null;
  let confirmationId = null;
  let reservationRestaurant = null;

  const creationResult = await withTransaction(async (client) => {
    await ReservationModel.acquireTransactionLock(
      client,
      buildUserDayLockKey({ userId, reservationDate: normalizedDate })
    );
    await ReservationModel.acquireTransactionLock(
      client,
      buildSlotLockKey({
        restaurantId: parsedRestaurantId,
        reservationDate: normalizedDate,
        reservationTime: normalizedTime,
      })
    );

    const transactionalUser = await UserModel.findById(client, userId);
    if (!transactionalUser) {
      return { success: false, status: 404, error: "User not found" };
    }
    if (transactionalUser.banned_until && !isBanActive(transactionalUser.banned_until)) {
      await UserModel.clearBan(client, transactionalUser.id);
      transactionalUser.banned_until = null;
    }
    if (transactionalUser.no_show_count >= 3 && !transactionalUser.banned_until) {
      const banUntil = addOneMonth();
      await UserModel.setBannedUntil(client, transactionalUser.id, banUntil);
      const label = formatBanDateLabel(banUntil);
      return {
        success: false,
        status: 403,
        error: `You are temporarily banned from booking until ${label} due to multiple no-shows.`,
      };
    }
    if (isBanActive(transactionalUser.banned_until)) {
      const label = formatBanDateLabel(toDateOnly(transactionalUser.banned_until));
      return {
        success: false,
        status: 403,
        error: `You are temporarily banned from booking until ${label} due to multiple no-shows.`,
      };
    }

    const activeUserReservationsResult = await ReservationModel.getActiveUserReservationsForDate(
      client,
      userId,
      normalizedDate
    );

    if (activeUserReservationsResult.rows.length > 0 && reservationMinutes != null) {
      for (const reservation of activeUserReservationsResult.rows) {
        const existingMinutes = parseTimeToMinutes(reservation.reservation_time);
        if (existingMinutes == null) continue;

        const diff = Math.abs(reservationMinutes - existingMinutes);
        if (diff === 0) {
          return {
            success: false,
            status: 409,
            error: "You already have a reservation at this time. Please choose a different time slot.",
          };
        }

        if (diff < 120) {
          const existingLabel = formatTimeForEmail(reservation.reservation_time);
          return {
            success: false,
            status: 409,
            error: `Please choose a time at least 2 hours apart from your other reservation at ${existingLabel}.`,
          };
        }
      }
    }

    const availability = await getSlotAvailability({
      restaurantId: parsedRestaurantId,
      reservationDate: normalizedDate,
      reservationTime: normalizedTime,
      partySize: parsedPartySize,
      seatingPreference: normalizedSeating,
      dbClient: client,
    });

    if (!availability.success) {
      return availability;
    }

    if (!isWithinOperatingHours(normalizedTime, availability.restaurant.opening_time, availability.restaurant.closing_time)) {
      return { success: false, status: 400, error: "Reservation time is outside restaurant operating hours" };
    }

    if (!availability.canAccommodateParty) {
      const suggestedTimes = await getSuggestedTimes({
        restaurantId: parsedRestaurantId,
        reservationDate: normalizedDate,
        reservationTime: normalizedTime,
        partySize: parsedPartySize,
        seatingPreference: normalizedSeating,
        restaurant: availability.restaurant,
        baseCapacity: availability.baseCapacity,
      });

      const preferredSeats = normalizedSeating
        ? availability.availableSeatsPreference
        : availability.availableSeats;
      const availableSeats = Math.max(preferredSeats ?? availability.availableSeats, 0);
      const seatLabel = normalizedSeating ? `${normalizedSeating} seats` : "seats";
      const tableComboIssue = availability.hasTableConfig && !availability.canFitTables;

      return {
        success: false,
        status: 409,
        error: tableComboIssue
          ? `No table combination available for a party of ${parsedPartySize} at that time`
          : `Only ${availableSeats} ${seatLabel} available`,
        availableSeats,
        suggestedTimes,
      };
    }

    reservationRestaurant = availability.restaurant;

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      confirmationId = createConfirmationId();
      try {
        const insertResult = await ReservationModel.createReservation(client, {
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
        if (error.code !== "23505") {
          throw error;
        }
      }
    }

    if (!createdReservation) {
      return { success: false, status: 409, error: "Reservation could not be created. Please try again." };
    }

    return { success: true };
  });

  if (!creationResult.success) {
    return creationResult;
  }

  if (user?.email) {
    try {
      await sendReservationConfirmationEmail({
        to: user.email,
        userName: user.full_name || "Guest",
        restaurantName: reservationRestaurant.name,
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
      restaurant_name: reservationRestaurant.name,
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
  if (!["accept", "reject", "no-show", "complete"].includes(normalizedAction)) {
    return { success: false, status: 400, error: "Action must be accept, reject, no-show, or complete" };
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

  if (normalizedAction === "no-show") {
    if (existing.status === "no-show") {
      return { success: true, status: 200, reservation: existing };
    }
    if (!["accepted", "confirmed"].includes(existing.status)) {
      return { success: false, status: 409, error: "Only accepted reservations can be marked as no-show" };
    }
  }

  if (normalizedAction === "complete") {
    if (existing.status === "completed") {
      return { success: true, status: 200, reservation: existing };
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
        : normalizedAction === "complete"
          ? "completed"
          : "no-show";
  const updatedResult = await ReservationModel.updateOwnerReservationStatus(db, {
    reservationId: parsedReservationId,
    ownerId: parsedOwnerId,
    status: nextStatus,
  });
  const updated = updatedResult.rows[0];
  if (!updated) {
    return { success: false, status: 409, error: "Reservation status could not be updated" };
  }

  if (normalizedAction === "no-show") {
    const updatedUser = await UserModel.incrementNoShowCount(db, updated.user_id);
    if (updatedUser?.email) {
      if (updatedUser.no_show_count === 2) {
        try {
          await sendNoShowWarningEmail({
            to: updatedUser.email,
            userName: updatedUser.full_name || "Guest",
          });
        } catch (error) {
          console.warn("Failed to send no-show warning email:", error.message);
        }
      }

      if (updatedUser.no_show_count >= 3) {
        const banUntil = addOneMonth();
        const banned = await UserModel.setBannedUntil(db, updated.user_id, banUntil);
        const label = formatBanDateLabel(banUntil);
        try {
          await sendNoShowBanEmail({
            to: updatedUser.email,
            userName: updatedUser.full_name || "Guest",
            bannedUntilLabel: label,
          });
        } catch (error) {
          console.warn("Failed to send no-show ban email:", error.message);
        }
        if (banned) {
          updated.banned_until = banned.banned_until;
        }
      }
    }
  }

  return { success: true, status: 200, reservation: updated };
};

const getSlotAdjustmentForOwner = async ({
  restaurantId,
  ownerId,
  reservationDate,
  reservationTime,
  seatingPreference,
}) => {
  const parsedRestaurantId = parseInt(restaurantId, 10);
  if (Number.isNaN(parsedRestaurantId)) {
    return { success: false, status: 400, error: "Invalid restaurant ID" };
  }

  const normalizedDate = String(reservationDate || "").trim();
  const normalizedTime = normalizeTime(reservationTime);
  if (!normalizedDate || !parseDateOnly(normalizedDate)) {
    return { success: false, status: 400, error: "Invalid reservation date" };
  }
  if (!normalizedTime) {
    return { success: false, status: 400, error: "Invalid reservation time" };
  }

  const normalizedPreference = normalizeAdjustmentPreference(seatingPreference);
  if (!normalizedPreference) {
    return { success: false, status: 400, error: "Invalid seating preference" };
  }

  const ownedRestaurant = await restaurantService.getRestaurantByIdAndOwnerId(parsedRestaurantId, ownerId);
  if (!ownedRestaurant) {
    return { success: false, status: 403, error: "Forbidden: You can only manage your own restaurant" };
  }

  const result = await ReservationModel.getSlotAdjustment(
    db,
    parsedRestaurantId,
    normalizedDate,
    normalizedTime,
    normalizedPreference
  );
  const row = result.rows[0];

  return {
    success: true,
    status: 200,
    adjustment: {
      restaurant_id: parsedRestaurantId,
      reservation_date: normalizedDate,
      reservation_time: normalizedTime,
      seating_preference: normalizedPreference,
      adjustment: row ? parseInt(row.adjustment, 10) || 0 : 0,
      has_adjustment: !!row,
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
  if (Number.isNaN(parsedRestaurantId)) {
    return { success: false, status: 400, error: "Invalid restaurant ID" };
  }

  const normalizedDate = String(reservationDate || "").trim();
  const normalizedTime = normalizeTime(reservationTime);
  if (!normalizedDate || !parseDateOnly(normalizedDate)) {
    return { success: false, status: 400, error: "Invalid reservation date" };
  }
  if (!normalizedTime) {
    return { success: false, status: 400, error: "Invalid reservation time" };
  }

  const normalizedPreference = normalizeAdjustmentPreference(seatingPreference);
  if (!normalizedPreference) {
    return { success: false, status: 400, error: "Invalid seating preference" };
  }

  const parsedAdjustment = parseInt(adjustment, 10);
  if (Number.isNaN(parsedAdjustment)) {
    return { success: false, status: 400, error: "Adjustment must be a number" };
  }
  if (Math.abs(parsedAdjustment) > MAX_ADJUSTMENT) {
    return { success: false, status: 400, error: `Adjustment must be between -${MAX_ADJUSTMENT} and ${MAX_ADJUSTMENT}` };
  }

  const ownedRestaurant = await restaurantService.getRestaurantByIdAndOwnerId(parsedRestaurantId, ownerId);
  if (!ownedRestaurant) {
    return { success: false, status: 403, error: "Forbidden: You can only manage your own restaurant" };
  }

  const result = await ReservationModel.upsertSlotAdjustment(db, {
    restaurantId: parsedRestaurantId,
    reservationDate: normalizedDate,
    reservationTime: normalizedTime,
    seatingPreference: normalizedPreference,
    adjustment: parsedAdjustment,
  });
  const saved = result.rows[0];

  return {
    success: true,
    status: 200,
    adjustment: {
      restaurant_id: parsedRestaurantId,
      reservation_date: normalizedDate,
      reservation_time: normalizedTime,
      seating_preference: normalizedPreference,
      adjustment: parseInt(saved.adjustment, 10) || 0,
    },
  };
};

const getAvailability = async ({
  restaurantId,
  reservationDate,
  reservationTime,
  partySize = null,
  seatingPreference = null,
}) => {
  const parsedRestaurantId = parseInt(restaurantId, 10);
  const normalizedDate = String(reservationDate || "").trim();
  const normalizedTime = normalizeTime(reservationTime);
  const parsedPartySize = partySize != null ? parseInt(partySize, 10) : 2;
  const normalizedSeating = normalizeSeatingPreference(seatingPreference);

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
    return { success: false, status: 400, error: "Invalid reservation time" };
  }
  if (Number.isNaN(parsedPartySize) || parsedPartySize < 1) {
    return { success: false, status: 400, error: "Invalid party size" };
  }
  if (seatingPreference && !normalizedSeating) {
    return { success: false, status: 400, error: "Invalid seating preference" };
  }

  const availability = await getSlotAvailability({
    restaurantId: parsedRestaurantId,
    reservationDate: normalizedDate,
    reservationTime: normalizedTime,
    partySize: parsedPartySize,
    seatingPreference: normalizedSeating,
  });

  if (!availability.success) {
    return availability;
  }

  const lowCapacityThreshold = Math.max(2, Math.floor(availability.totalCapacity * 0.2));
  const shouldSuggest = availability.availableSeats <= lowCapacityThreshold || !availability.canAccommodateParty;
  const suggestedTimes = shouldSuggest
    ? await getSuggestedTimes({
      restaurantId: parsedRestaurantId,
      reservationDate: normalizedDate,
      reservationTime: normalizedTime,
      partySize: parsedPartySize,
      seatingPreference: normalizedSeating,
      restaurant: availability.restaurant,
      baseCapacity: availability.baseCapacity,
    })
    : [];

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
      is_fully_booked: availability.availableSeats <= 0,
      can_accommodate_party: availability.canAccommodateParty,
      seating_preference: normalizedSeating,
      preference_capacity: availability.preferenceCapacity,
      booked_seats_preference: availability.bookedSeatsPreference,
      available_seats_preference: availability.availableSeatsPreference,
      table_constraint_ok: availability.canFitTables,
      suggested_times: suggestedTimes,
    },
  };
};


module.exports = {
  createReservation,
  getReservationsForUser,
  getReservationsForOwner,
  cancelReservation,
  updateReservationStatusForOwner,
  getAvailability,
  getSlotAdjustmentForOwner,
  upsertSlotAdjustmentForOwner,
};
