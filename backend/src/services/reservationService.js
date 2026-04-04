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
} = require("../utils/emailSender");

const MAX_PARTY_SIZE = 12;
const MIN_RESERVATION_MINUTES = 0;
const ALLOWED_SEATING_PREFERENCES = new Set(["indoor", "outdoor"]);
const ALLOWED_ADJUSTMENT_PREFERENCES = new Set(["any", "indoor", "outdoor"]);
const MAX_ADJUSTMENT = 200;

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

const normalizeSeatingPreference = (value) => {
  if (value == null || String(value).trim() === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (!ALLOWED_SEATING_PREFERENCES.has(normalized)) return null;
  return normalized;
};

const normalizeAdjustmentPreference = (value) => {
  if (value == null || String(value).trim() === "") return "any";
  const normalized = String(value).trim().toLowerCase();
  if (!ALLOWED_ADJUSTMENT_PREFERENCES.has(normalized)) return null;
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
  seatingPreference = null,
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
      totalCapacityOverride: totalCapacity,
    });

    if (availability.success && availability.canAccommodateParty) {
      suggestions.push(candidateTime.slice(0, 5));
    }

    if (suggestions.length >= 3) break;
  }

  return suggestions;
};

const getDisabledSlotState = async ({
  restaurantId,
  reservationDate,
  reservationTime,
  seatingPreference = null,
}) => {
  const normalizedSeating = seatingPreference ? String(seatingPreference).trim().toLowerCase() : null;

  const exactResult = await ReservationModel.getDisabledSlot(
    db,
    restaurantId,
    reservationDate,
    reservationTime,
    normalizedSeating || "any"
  );
  const exactMatch = exactResult.rows[0] || null;
  if (exactMatch) {
    return {
      isDisabled: true,
      appliesTo: exactMatch.seating_preference || "any",
      disabledSlot: exactMatch,
    };
  }

  if (normalizedSeating) {
    const anyResult = await ReservationModel.getDisabledSlot(
      db,
      restaurantId,
      reservationDate,
      reservationTime,
      "any"
    );
    const anyMatch = anyResult.rows[0] || null;
    if (anyMatch) {
      return {
        isDisabled: true,
        appliesTo: "any",
        disabledSlot: anyMatch,
      };
    }
  }

  return {
    isDisabled: false,
    appliesTo: null,
    disabledSlot: null,
  };
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

  const totalCapacityBase = totalCapacityOverride ?? buildCapacityFromConfig(tableConfig);
  const tableCounts = buildTableCounts(tableConfig);
  const hasTableConfig = (tableCounts.seats2 + tableCounts.seats4 + tableCounts.seats6) > 0;
  const slotAdjustmentsResult = await ReservationModel.getSlotAdjustments(
    dbClient,
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
    dbClient,
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
      dbClient,
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

  const disabledState = await getDisabledSlotState({
    restaurantId,
    reservationDate,
    reservationTime,
    seatingPreference: normalizedSeating,
  });

  let canFitTables = true;
  if (hasTableConfig) {
    const slotReservationsResult = await ReservationModel.getReservationsForSlot(
      dbClient,
      restaurantId,
      reservationDate,
      reservationTime
    );
    const parties = (slotReservationsResult.rows || [])
      .map((reservation) => parseInt(reservation.party_size, 10))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (partySize != null) {
      const requestedPartySize = parseInt(partySize, 10);
      if (Number.isFinite(requestedPartySize) && requestedPartySize > 0) {
        parties.push(requestedPartySize);
      }
    }

    canFitTables = canSeatPartiesWithTables(parties, tableCounts);
  }

  const availableSeatsForRequest =
    normalizedSeating && availableSeatsPreference != null
      ? Math.min(availableSeats, availableSeatsPreference)
      : availableSeats;
  const requestedPartySize = partySize != null ? parseInt(partySize, 10) : null;
  const canAccommodateParty = requestedPartySize == null
    ? availableSeatsForRequest > 0
    : (availableSeatsForRequest >= requestedPartySize && canFitTables);

  return {
    success: true,
    restaurant,
    isDisabled: disabledState.isDisabled,
    disabledAppliesTo: disabledState.appliesTo,
    disabledSlot: disabledState.disabledSlot,
    anyAdjustment,
    totalAdjustment,
    totalCapacity,
    bookedSeats,
    availableSeats,
    preferenceCapacity,
    bookedSeatsPreference,
    availableSeatsPreference,
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

  const user = await UserModel.findById(db, userId);
  if (!user) {
    return { success: false, status: 404, error: "User not found" };
  }
  if (user.banned_until && !isBanActive(user.banned_until)) {
    await UserModel.clearBan(db, user.id);
  }

  if (availability.isDisabled) {
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
      error: "This time slot has been disabled by the restaurant",
      availableSeats: 0,
      suggestedTimes,
      disabled: true,
    };
  }

  if (!isWithinOperatingHours(normalizedTime, availability.restaurant.opening_time, availability.restaurant.closing_time)) {
    return { success: false, status: 400, error: "Reservation time is outside restaurant operating hours" };
  }
  if (user.no_show_count >= NO_SHOW_BAN_THRESHOLD && !user.banned_until) {
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
    if (transactionalUser.no_show_count >= NO_SHOW_BAN_THRESHOLD && !transactionalUser.banned_until) {
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

    const availableSeatsForRequest =
      normalizedSeating && availability.availableSeatsPreference != null
        ? Math.min(availability.availableSeats, availability.availableSeatsPreference)
        : availability.availableSeats;

    if (!availability.canAccommodateParty) {
      const suggestedTimes = await getSuggestedTimes({
        restaurantId: parsedRestaurantId,
        reservationDate: normalizedDate,
        reservationTime: normalizedTime,
        partySize: parsedPartySize,
        restaurant: availability.restaurant,
        totalCapacity: availability.totalCapacity,
        seatingPreference: normalizedSeating,
      });

      return {
        success: false,
        status: 409,
        error: availability.hasTableConfig && !availability.canFitTables
          ? `No table combination available for a party of ${parsedPartySize} at that time`
          : normalizedSeating && availability.availableSeatsPreference != null
            ? `Only ${availableSeatsForRequest} ${normalizedSeating} seats available`
            : `Only ${availableSeatsForRequest} seats available`,
        availableSeats: availableSeatsForRequest,
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

  if (user?.email && reservationRestaurant?.name) {
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
  const parsedOwnerId = parseInt(ownerId, 10);
  const normalizedDate = String(reservationDate || "").trim();
  const normalizedTime = normalizeTime(reservationTime);
  const normalizedSeating = normalizeAdjustmentPreference(seatingPreference);

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
  if (!normalizedSeating) {
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
  const normalizedSeating = normalizeAdjustmentPreference(seatingPreference);

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
  if (Math.abs(parsedAdjustment) > MAX_ADJUSTMENT) {
    return { success: false, status: 400, error: `Adjustment must be between -${MAX_ADJUSTMENT} and ${MAX_ADJUSTMENT}` };
  }
  if (!normalizedSeating) {
    return { success: false, status: 400, error: "Invalid seating preference" };
  }

  const restaurantResult = await ReservationModel.getRestaurantById(db, parsedRestaurantId);
  const restaurant = restaurantResult.rows[0];
  if (!restaurant || parseInt(restaurant.owner_id, 10) !== parsedOwnerId) {
    return { success: false, status: 404, error: "Restaurant not found" };
  }

  const availability = await getSlotAvailability({
    restaurantId: parsedRestaurantId,
    reservationDate: normalizedDate,
    reservationTime: normalizedTime,
    seatingPreference: normalizedSeating === "any" ? null : normalizedSeating,
  });
  if (!availability.success) {
    return availability;
  }

  if (parsedAdjustment < 0) {
    const relevantBookedSeats = normalizedSeating === "any"
      ? availability.bookedSeats
      : (availability.bookedSeatsPreference || 0);
    const relevantCapacity = normalizedSeating === "any"
      ? availability.totalCapacity
      : (availability.preferenceCapacity ?? availability.totalCapacity);
    const currentAvailableSeats = Math.max(relevantCapacity - relevantBookedSeats, 0);

    if (Math.abs(parsedAdjustment) > currentAvailableSeats) {
      return {
        success: false,
        status: 409,
        error: `Cannot reduce by ${Math.abs(parsedAdjustment)} seats because ${relevantBookedSeats} seats are already booked`,
      };
    }
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
    partySize: parsedPartySize,
    seatingPreference: normalizedSeating,
  });

  if (!availability.success) {
    return availability;
  }

  const disabledState = {
    isDisabled: availability.isDisabled === true,
    appliesTo: availability.disabledAppliesTo || null,
  };

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
  disabledState.isDisabled ||
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
      seatingPreference: normalizedSeating,
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
    available_seats: disabledState.isDisabled ? 0 : availableSeatsForRequest,
    is_disabled: disabledState.isDisabled,
    disabled_applies_to: disabledState.appliesTo,
    is_fully_booked: disabledState.isDisabled ? true : availableSeatsForRequest <= 0,
    is_outside_operating_hours: !withinOperatingHours,
    can_accommodate_party:
      !disabledState.isDisabled && withinOperatingHours && availability.canAccommodateParty,
    table_constraint_ok: availability.canFitTables,
    suggested_times: suggestedTimes,
  },
};
};


const getDisabledSlotsForRestaurant = async ({
  restaurantId,
  reservationDate,
}) => {
  const parsedRestaurantId = parseInt(restaurantId, 10);
  const normalizedDate = String(reservationDate || "").trim();

  if (Number.isNaN(parsedRestaurantId)) {
    return { success: false, status: 400, error: "Invalid restaurant ID" };
  }
  if (!normalizedDate || !parseDateOnly(normalizedDate)) {
    return { success: false, status: 400, error: "Invalid reservation date" };
  }

  const restaurantResult = await ReservationModel.getRestaurantById(db, parsedRestaurantId);
  const restaurant = restaurantResult.rows[0];
  if (!restaurant) {
    return { success: false, status: 404, error: "Restaurant not found" };
  }

  const disabledSlotsResult = await ReservationModel.getDisabledSlotsForDate(
    db,
    parsedRestaurantId,
    normalizedDate
  );

  return {
    success: true,
    status: 200,
    disabledSlots: disabledSlotsResult.rows || [],
  };
};

const getDisabledSlotsForOwner = async ({
  restaurantId,
  ownerId,
  reservationDate,
}) => {
  const parsedRestaurantId = parseInt(restaurantId, 10);
  const parsedOwnerId = parseInt(ownerId, 10);
  const normalizedDate = String(reservationDate || "").trim();

  if (Number.isNaN(parsedRestaurantId)) {
    return { success: false, status: 400, error: "Invalid restaurant ID" };
  }
  if (Number.isNaN(parsedOwnerId)) {
    return { success: false, status: 400, error: "Invalid owner ID" };
  }
  if (!normalizedDate || !parseDateOnly(normalizedDate)) {
    return { success: false, status: 400, error: "Invalid reservation date" };
  }

  const restaurantResult = await ReservationModel.getRestaurantById(db, parsedRestaurantId);
  const restaurant = restaurantResult.rows[0];
  if (!restaurant || parseInt(restaurant.owner_id, 10) !== parsedOwnerId) {
    return { success: false, status: 404, error: "Restaurant not found" };
  }

  const disabledSlotsResult = await ReservationModel.getDisabledSlotsForDate(
    db,
    parsedRestaurantId,
    normalizedDate
  );

  return {
    success: true,
    status: 200,
    disabledSlots: disabledSlotsResult.rows || [],
  };
};

const upsertDisabledSlotForOwner = async ({
  restaurantId,
  ownerId,
  reservationDate,
  reservationTime,
  seatingPreference,
  reason,
  disabled,
}) => {
  const parsedRestaurantId = parseInt(restaurantId, 10);
  const parsedOwnerId = parseInt(ownerId, 10);
  const normalizedDate = String(reservationDate || "").trim();
  const normalizedTime = normalizeTime(reservationTime);
  const normalizedSeating = String(seatingPreference || "any").trim().toLowerCase() || "any";
  const shouldDisable = Boolean(disabled);
  const cleanedReason = reason == null ? null : String(reason).trim().slice(0, 250);

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

  if (shouldDisable) {
    const savedResult = await ReservationModel.upsertDisabledSlot(db, {
      restaurantId: parsedRestaurantId,
      reservationDate: normalizedDate,
      reservationTime: normalizedTime,
      seatingPreference: normalizedSeating,
      reason: cleanedReason,
    });
    return {
      success: true,
      status: 200,
      disabledSlot: {
        disabled: true,
        ...(savedResult.rows[0] || {}),
      },
    };
  }

  const deletedResult = await ReservationModel.deleteDisabledSlot(
    db,
    parsedRestaurantId,
    normalizedDate,
    normalizedTime,
    normalizedSeating
  );

  return {
    success: true,
    status: 200,
    disabledSlot: {
      disabled: false,
      restaurant_id: parsedRestaurantId,
      reservation_date: normalizedDate,
      reservation_time: normalizedTime,
      seating_preference: normalizedSeating,
      ...(deletedResult.rows[0] || {}),
    },
  };
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
  getSlotAdjustmentForOwner,
  upsertSlotAdjustmentForOwner,
  getDisabledSlotsForRestaurant,
  getDisabledSlotsForOwner,
  upsertDisabledSlotForOwner,
  getAvailability,
  markNoShow,
};
