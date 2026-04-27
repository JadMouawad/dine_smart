const db = require("../config/db");
const eventRepository = require("../repositories/eventRepository");
const ReservationModel = require("../models/reservation.model");
const subscriptionService = require("./subscriptionService");
const loyaltyService = require("./loyaltyService");
const { sendReservationCancelledForEventEmail, sendNoShowWarningEmail, sendNoShowBanEmail } = require("../utils/emailSender");
const UserModel = require("../models/User");

const SLOT_STEP_MINUTES = 30;

const parsePositiveInt = (value) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
};

const parseDate = (value) => {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return normalized;
};

const parseBoolean = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

const parseTime = (value) => {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!/^\d{2}:\d{2}$/.test(normalized)) return null;
  return normalized;
};

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateTimeStamp = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null;
  const stamp = new Date(`${dateValue}T${timeValue}:00`);
  return Number.isNaN(stamp.getTime()) ? null : stamp;
};

const formatDateForEmail = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

const formatTimeForEmail = (value) => {
  const [hoursStr = "0", minutesStr = "00"] = String(value || "").split(":");
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return String(value || "");
  const normalizedHours = ((hours + 11) % 12) + 1;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${normalizedHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

const toDateKey = (date) => date.toISOString().slice(0, 10);

const toTimeKey = (date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:00`;

const buildDisabledEventSlots = ({ startDate, endDate, startTime, endTime }) => {
  const startStamp = parseDateTimeStamp(startDate, startTime);
  const endStamp = parseDateTimeStamp(endDate, endTime);
  if (!startStamp || !endStamp || endStamp <= startStamp) return [];

  const slots = [];
  const cursor = new Date(startStamp.getTime());

  while (cursor < endStamp) {
    slots.push({
      reservationDate: toDateKey(cursor),
      reservationTime: toTimeKey(cursor),
    });
    cursor.setMinutes(cursor.getMinutes() + SLOT_STEP_MINUTES);
  }

  return slots;
};

const sendCancelledReservationEmails = async ({ reservations, eventTitle }) => {
  await Promise.all(
    reservations.map(async (reservation) => {
      if (!reservation.customer_email) return;
      try {
        await sendReservationCancelledForEventEmail({
          to: reservation.customer_email,
          userName: reservation.customer_name || "Guest",
          restaurantName: reservation.restaurant_name,
          reservationDate: formatDateForEmail(reservation.reservation_date),
          reservationTime: formatTimeForEmail(reservation.reservation_time),
          eventTitle,
        });
      } catch (error) {
        console.warn(`Failed to send event cancellation email for reservation ${reservation.id}:`, error.message);
      }
    })
  );
};

const parseAttendeeCount = (value) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return 1;
  return Math.min(parsed, 20);
};

const parseSeatingPreference = (value) => {
  if (!value) return "any";
  const normalized = String(value).trim().toLowerCase();
  if (["any", "indoor", "outdoor"].includes(normalized)) return normalized;
  return "any";
};

const validateDateRange = (startDate, endDate) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) {
    return { error: "start_date and end_date must be valid YYYY-MM-DD dates" };
  }
  if (start > end) {
    return { error: "start_date must be before or equal to end_date" };
  }
  return { start, end };
};

const validateDateTimeRange = (startDate, startTime, endDate, endTime) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const startT = parseTime(startTime);
  const endT = parseTime(endTime);
  if (!start || !end) return { error: "start_date and end_date are required (YYYY-MM-DD)" };
  if (!startT || !endT) return { error: "start_time and end_time are required (HH:MM)" };
  if (start < getTodayDateString()) {
    return { error: "Events can only be created for today or a future date" };
  }
  const startStamp = new Date(`${start}T${startT}:00Z`);
  const endStamp = new Date(`${end}T${endT}:00Z`);
  if (Number.isNaN(startStamp.getTime()) || Number.isNaN(endStamp.getTime())) {
    return { error: "Invalid start or end time" };
  }
  if (endStamp <= startStamp) {
    return { error: "end datetime must be after start datetime" };
  }
  return { start, end, startTime: startT, endTime: endT };
};

const assertOwnerCanPublish = async ({ ownerId, restaurantId }) => {
  const parsedRestaurantId = parsePositiveInt(restaurantId);
  if (!parsedRestaurantId) {
    return { success: false, status: 400, error: "Invalid restaurant ID" };
  }

  const ownedRestaurant = await eventRepository.getOwnedRestaurantById({
    ownerId,
    restaurantId: parsedRestaurantId,
  });

  if (!ownedRestaurant) {
    return { success: false, status: 403, error: "You can only manage events for your own restaurant" };
  }

  if (!ownedRestaurant.is_verified || ownedRestaurant.approval_status !== "approved") {
    return { success: false, status: 409, error: "Only approved restaurants can publish events" };
  }

  return { success: true, restaurant: ownedRestaurant };
};

const createOwnerEvent = async ({ ownerId, payload }) => {
  const title = String(payload.title || "").trim();
  if (!title) return { success: false, status: 400, error: "title is required" };
  if (title.length > 200) return { success: false, status: 400, error: "title must be at most 200 characters" };

  const description = payload.description != null ? String(payload.description).trim() : "";
  if (!description) return { success: false, status: 400, error: "description is required" };
  const imageUrl = payload.image_url != null ? String(payload.image_url).trim() : null;

  const dateTimeValidation = validateDateTimeRange(
    payload.start_date,
    payload.start_time,
    payload.end_date,
    payload.end_time
  );
  if (dateTimeValidation.error) {
    return { success: false, status: 400, error: dateTimeValidation.error };
  }

  const hasUnlimitedAttendees = parseBoolean(payload.max_attendees_unlimited, false);
  let maxAttendees = null;
  if (!hasUnlimitedAttendees && (payload.max_attendees == null || payload.max_attendees === "")) {
    return { success: false, status: 400, error: "max_attendees is required" };
  }
  if (!hasUnlimitedAttendees) {
    maxAttendees = parsePositiveInt(payload.max_attendees);
    if (!maxAttendees) {
      return { success: false, status: 400, error: "max_attendees must be a positive number" };
    }
  }
  const isFree = parseBoolean(payload.is_free, true);
  const priceRaw = payload.price != null ? Number(payload.price) : null;
  if (!isFree && (!Number.isFinite(priceRaw) || priceRaw < 0)) {
    return { success: false, status: 400, error: "price is required for paid events" };
  }
  const price = isFree ? null : priceRaw;
  const tags = Array.isArray(payload.tags) ? payload.tags.map((t) => String(t).trim()).filter(Boolean) : [];
  const locationOverride = payload.location_override != null ? String(payload.location_override).trim() : null;

  const ownershipCheck = await assertOwnerCanPublish({
    ownerId,
    restaurantId: payload.restaurant_id,
  });
  if (!ownershipCheck.success) return ownershipCheck;

  const conflicts = await eventRepository.getConflictingReservationsForOwnerEvent({
    restaurantId: ownershipCheck.restaurant.id,
    startDate: dateTimeValidation.start,
    endDate: dateTimeValidation.end,
    startTime: dateTimeValidation.startTime,
    endTime: dateTimeValidation.endTime,
  });
  const confirmImpact = parseBoolean(payload.confirm_impact, false) === true;

  if (conflicts.length > 0 && !confirmImpact) {
    return {
      success: false,
      status: 409,
      error: "Creating this event will impact existing reservations.",
      code: "EVENT_RESERVATION_CONFLICT",
      details: {
        affectedReservationsCount: conflicts.length,
      },
    };
  }

  const disabledSlots = buildDisabledEventSlots({
    startDate: dateTimeValidation.start,
    endDate: dateTimeValidation.end,
    startTime: dateTimeValidation.startTime,
    endTime: dateTimeValidation.endTime,
  });

  const client = await db.connect();
  let created = null;
  let cancelledReservations = [];
  try {
    await client.query("BEGIN");

    created = await eventRepository.createOwnerEvent({
      restaurantId: ownershipCheck.restaurant.id,
      title,
      description,
      imageUrl,
      startDate: dateTimeValidation.start,
      endDate: dateTimeValidation.end,
      startTime: dateTimeValidation.startTime,
      endTime: dateTimeValidation.endTime,
      maxAttendees,
      isFree,
      price,
      tags,
      locationOverride,
      isActive: parseBoolean(payload.is_active, true),
    }, client);

    for (const slot of disabledSlots) {
      await ReservationModel.upsertDisabledSlot(client, {
        restaurantId: ownershipCheck.restaurant.id,
        reservationDate: slot.reservationDate,
        reservationTime: slot.reservationTime,
        seatingPreference: "any",
        reason: "Reserved for event",
      });
    }

    for (const reservation of conflicts) {
      const cancelledResult = await ReservationModel.cancelReservation(client, reservation.id);
      if (cancelledResult.rows[0]) {
        cancelledReservations.push(reservation);
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (cancelledReservations.length > 0) {
    await sendCancelledReservationEmails({
      reservations: cancelledReservations,
      eventTitle: created?.title || title,
    });
  }

  try {
    const restaurantName = ownershipCheck.restaurant.name || "Restaurant";
    const timeLabel = created.start_time && created.end_time
      ? `${String(created.start_time).slice(0, 5)} – ${String(created.end_time).slice(0, 5)}`
      : created.start_time
        ? String(created.start_time).slice(0, 5)
        : "Time to be announced";
    const dateLabel = created.start_date && created.end_date
      ? `${created.start_date} → ${created.end_date}`
      : created.start_date || "Date to be announced";
    await subscriptionService.sendSubscriptionUpdateOnce({
      updateType: "events",
      subject: `New event at ${restaurantName}: ${created.title}`,
      message: `${created.title} is coming up at ${restaurantName}.\nDate: ${dateLabel}\nTime: ${timeLabel}`,
      entityType: "event",
      entityId: created.id,
      fingerprint: `created:${created.id}`,
    });
  } catch (error) {
    console.warn("Failed to send event subscription update:", error.message);
  }

  return { success: true, status: 201, data: created };
};

const getOwnerEvents = async ({ ownerId }) => {
  const events = await eventRepository.getOwnerEvents(ownerId);
  return { success: true, status: 200, data: events };
};

const updateOwnerEvent = async ({ ownerId, eventId, payload }) => {
  const parsedEventId = parsePositiveInt(eventId);
  if (!parsedEventId) return { success: false, status: 400, error: "Invalid event ID" };

  const existing = await eventRepository.getOwnerEventById({ ownerId, eventId: parsedEventId });
  if (!existing) return { success: false, status: 404, error: "Event not found" };

  const updates = {};
  if (payload.title != null) {
    const title = String(payload.title).trim();
    if (!title) return { success: false, status: 400, error: "title cannot be empty" };
    if (title.length > 200) return { success: false, status: 400, error: "title must be at most 200 characters" };
    updates.title = title;
  }
  if (payload.description != null) updates.description = String(payload.description).trim() || null;
  if (payload.image_url != null) updates.image_url = String(payload.image_url).trim() || null;
  if (payload.max_attendees != null || payload.max_attendees_unlimited != null) {
    const hasUnlimitedAttendees = parseBoolean(payload.max_attendees_unlimited, false);
    if (hasUnlimitedAttendees) {
      updates.max_attendees = null;
    } else {
      if (payload.max_attendees == null || payload.max_attendees === "") {
        return { success: false, status: 400, error: "max_attendees is required" };
      }
      const parsedMax = parsePositiveInt(payload.max_attendees);
      if (!parsedMax) return { success: false, status: 400, error: "max_attendees must be a positive number" };
      updates.max_attendees = parsedMax;
    }
  }
  if (payload.is_free != null) {
    const parsed = parseBoolean(payload.is_free, null);
    if (parsed == null) return { success: false, status: 400, error: "is_free must be true or false" };
    updates.is_free = parsed;
  }
  if (payload.price != null) {
    const priceValue = payload.price === "" ? null : Number(payload.price);
    if (priceValue != null && (!Number.isFinite(priceValue) || priceValue < 0)) {
      return { success: false, status: 400, error: "price must be a positive number" };
    }
    updates.price = priceValue;
  }
  if (payload.tags != null && Array.isArray(payload.tags)) updates.tags = payload.tags.map((t) => String(t).trim()).filter(Boolean);
  if (payload.location_override != null) updates.location_override = String(payload.location_override).trim() || null;
  if (payload.is_active != null) {
    const parsed = parseBoolean(payload.is_active, null);
    if (parsed == null) return { success: false, status: 400, error: "is_active must be true or false" };
    updates.is_active = parsed;
  }

  const startDateInput = payload.start_date ?? existing.start_date;
  const endDateInput = payload.end_date ?? existing.end_date;
  const startTimeInput = payload.start_time ?? existing.start_time;
  const endTimeInput = payload.end_time ?? existing.end_time;
  if (payload.start_date != null || payload.end_date != null || payload.start_time != null || payload.end_time != null) {
    const dateTimeValidation = validateDateTimeRange(startDateInput, startTimeInput, endDateInput, endTimeInput);
    if (dateTimeValidation.error) {
      return { success: false, status: 400, error: dateTimeValidation.error };
    }
    updates.start_date = dateTimeValidation.start;
    updates.end_date = dateTimeValidation.end;
    updates.start_time = dateTimeValidation.startTime;
    updates.end_time = dateTimeValidation.endTime;
  }

  if (Object.keys(updates).length === 0) {
    return { success: true, status: 200, data: existing };
  }

  if (updates.is_free === true) {
    updates.price = null;
  } else if (updates.is_free === false && updates.price == null) {
    return { success: false, status: 400, error: "price is required for paid events" };
  }

  const updated = await eventRepository.updateOwnerEvent({
    ownerId,
    eventId: parsedEventId,
    updates,
  });

  if (!updated) return { success: false, status: 404, error: "Event not found" };
  return { success: true, status: 200, data: updated };
};

const deleteOwnerEvent = async ({ ownerId, eventId }) => {
  const parsedEventId = parsePositiveInt(eventId);
  if (!parsedEventId) return { success: false, status: 400, error: "Invalid event ID" };

  const deleted = await eventRepository.deleteOwnerEvent({ ownerId, eventId: parsedEventId });
  if (!deleted) return { success: false, status: 404, error: "Event not found" };

  return { success: true, status: 200, data: deleted };
};

const getPublicEvents = async (query) => {
  const limitRaw = parsePositiveInt(query.limit);
  const limit = Math.min(limitRaw || 40, 100);

  const latitude = query.latitude != null ? Number(query.latitude) : null;
  const longitude = query.longitude != null ? Number(query.longitude) : null;
  const radius = query.distance_radius != null ? Number(query.distance_radius) : null;

  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);
  const distanceRadius = Number.isFinite(radius) && radius > 0 ? radius : null;

  const events = await eventRepository.getPublicEvents({
    latitude: hasCoords ? latitude : null,
    longitude: hasCoords ? longitude : null,
    distanceRadius,
    limit,
  });

  return { success: true, status: 200, data: events };
};

const getRestaurantPublicEvents = async (restaurantId) => {
  const parsedRestaurantId = parsePositiveInt(restaurantId);
  if (!parsedRestaurantId) return { success: false, status: 400, error: "Invalid restaurant ID" };

  const events = await eventRepository.getPublicEventsByRestaurantId(parsedRestaurantId);
  return { success: true, status: 200, data: events };
};

const getOwnerEventAttendees = async ({ ownerId, eventId }) => {
  const parsedEventId = parsePositiveInt(eventId);
  if (!parsedEventId) return { success: false, status: 400, error: "Invalid event ID" };
  const attendees = await eventRepository.getOwnerEventAttendees({ ownerId, eventId: parsedEventId });
  return { success: true, status: 200, data: attendees };
};

const joinEvent = async ({ userId, eventId, payload }) => {
  const parsedEventId = parsePositiveInt(eventId);
  if (!parsedEventId) return { success: false, status: 400, error: "Invalid event ID" };

  const attendeesCount = parseAttendeeCount(payload.attendees_count ?? payload.attendees);
  const seatingPreference = parseSeatingPreference(payload.seating_preference ?? payload.seating);
  const notes = payload.notes != null ? String(payload.notes).trim().slice(0, 500) : null;

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [parsedEventId]);

    const event = await eventRepository.getPublicEventById(parsedEventId, client);
    if (!event) {
      await client.query("ROLLBACK");
      return { success: false, status: 404, error: "Event not found" };
    }

    const existingAttendee = await eventRepository.getEventAttendeeByUser({ eventId: parsedEventId, userId }, client);
    if (existingAttendee && String(existingAttendee.status || "").toLowerCase() === "confirmed") {
      await client.query("ROLLBACK");
      return { success: false, status: 409, error: "You have already reserved this event." };
    }

    const upcoming = await eventRepository.getUserUpcomingEventReservations({ userId }, client);
    const toDateTime = (dateValue, timeValue, fallbackTime) => {
      const datePart = String(dateValue || "").trim();
      const timePart = timeValue ? String(timeValue).slice(0, 8) : fallbackTime;
      const stamp = new Date(`${datePart}T${timePart || fallbackTime}`);
      return Number.isNaN(stamp.getTime()) ? null : stamp;
    };
    const newStart = toDateTime(event.start_date, event.start_time, "00:00:00");
    const newEnd = toDateTime(event.end_date, event.end_time, "23:59:59");

    if (newStart && newEnd) {
      for (const existing of upcoming) {
        if (existing.event_id === parsedEventId) continue;
        const existingStart = toDateTime(existing.start_date, existing.start_time, "00:00:00");
        const existingEnd = toDateTime(existing.end_date, existing.end_time, "23:59:59");
        if (!existingStart || !existingEnd) continue;
        if (newStart < existingEnd && newEnd > existingStart) {
          await client.query("ROLLBACK");
          return {
            success: false,
            status: 409,
            error: "You already have a reservation for another event at this time.",
          };
        }
      }
    }

    const capacity = await eventRepository.getEventCapacitySummary({ eventId: parsedEventId }, client);
    if (capacity?.max_attendees) {
      const currentBooked = Number(capacity.booked || 0);
      const remainingAttendees = Math.max(Number(capacity.max_attendees) - currentBooked, 0);
      const proposedTotal = currentBooked + attendeesCount;
      if (proposedTotal > capacity.max_attendees) {
        await client.query("ROLLBACK");
        return {
          success: false,
          status: 409,
          error: remainingAttendees > 0
            ? `Only ${remainingAttendees} attendee ${remainingAttendees === 1 ? "spot is" : "spots are"} left for this event.`
            : "Event is at full capacity.",
          details: {
            maxAttendees: Number(capacity.max_attendees),
            booked: currentBooked,
            remainingAttendees,
          },
        };
      }
    }

    const saved = existingAttendee
      ? await eventRepository.upsertEventAttendee({
          eventId: parsedEventId,
          userId,
          attendeesCount,
          seatingPreference,
          notes,
        }, client)
      : await eventRepository.createEventAttendee({
          eventId: parsedEventId,
          userId,
          attendeesCount,
          seatingPreference,
          notes,
        }, client);

    await loyaltyService.awardPointsForEvent({
      userId,
      attendeeId: saved.id,
      db: client,
    });

    await client.query("COMMIT");
    return { success: true, status: 200, data: saved };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
};

const getUserEventReservations = async ({ userId }) => {
  const reservations = await eventRepository.getUserEventReservations({ userId });
  return { success: true, status: 200, data: reservations };
};

const cancelUserEventReservation = async ({ userId, eventId }) => {
  const parsedEventId = parsePositiveInt(eventId);
  if (!parsedEventId) return { success: false, status: 400, error: "Invalid event ID" };

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const updated = await eventRepository.cancelEventAttendeeByUser({ eventId: parsedEventId, userId }, client);
    if (!updated) {
      await client.query("ROLLBACK");
      return { success: false, status: 404, error: "Event reservation not found" };
    }

    await loyaltyService.reversePointsForEvent({
      userId,
      attendeeId: updated.id,
      db: client,
    });

    await client.query("COMMIT");
    return { success: true, status: 200, data: updated };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
};

const getOwnerEventReservations = async ({ ownerId }) => {
  const reservations = await eventRepository.getOwnerEventReservations({ ownerId });
  return { success: true, status: 200, data: reservations };
};

const deleteOwnerEventReservation = async ({ ownerId, reservationId }) => {
  const parsedReservationId = parsePositiveInt(reservationId);
  if (!parsedReservationId) return { success: false, status: 400, error: "Invalid reservation ID" };

  const existing = await eventRepository.getOwnerEventReservationById({ ownerId, reservationId: parsedReservationId });
  if (!existing) return { success: false, status: 404, error: "Reservation not found" };

  const endDate = existing.end_date || existing.start_date;
  const endTime = existing.end_time || "23:59:59";
  const endStamp = new Date(`${endDate}T${String(endTime).slice(0, 8)}`);
  if (!Number.isNaN(endStamp.getTime())) {
    if (endStamp > new Date()) {
      return { success: false, status: 409, error: "Only past reservations can be deleted" };
    }
  }

  const removed = await eventRepository.deleteEventReservationById({ reservationId: parsedReservationId });
  if (!removed) return { success: false, status: 409, error: "Reservation could not be deleted" };
  return { success: true, status: 200, data: removed };
};

const saveEvent = async ({ userId, eventId }) => {
  const parsedEventId = parsePositiveInt(eventId);
  if (!parsedEventId) return { success: false, status: 400, error: "Invalid event ID" };

  const event = await eventRepository.getPublicEventById(parsedEventId);
  if (!event) return { success: false, status: 404, error: "Event not found" };

  await eventRepository.saveEventForUser({ eventId: parsedEventId, userId });
  return { success: true, status: 200, data: { saved: true } };
};

const unsaveEvent = async ({ userId, eventId }) => {
  const parsedEventId = parsePositiveInt(eventId);
  if (!parsedEventId) return { success: false, status: 400, error: "Invalid event ID" };

  const removed = await eventRepository.removeSavedEventForUser({ eventId: parsedEventId, userId });
  return { success: true, status: 200, data: { saved: false, removed } };
};

const getSavedEvents = async ({ userId }) => {
  const events = await eventRepository.getSavedEventsByUser({ userId });
  return { success: true, status: 200, data: events };
};

const NO_SHOW_BAN_THRESHOLD = 3;
const NO_SHOW_BAN_DAYS = 30;

const markEventAttendeeNoShow = async ({ attendeeId, ownerId }) => {
  const parsedAttendeeId = parseInt(attendeeId, 10);
  const parsedOwnerId = parseInt(ownerId, 10);

  if (Number.isNaN(parsedAttendeeId)) {
    return { success: false, status: 400, error: "Invalid attendee ID" };
  }

  const updated = await eventRepository.markEventAttendeeNoShow({ attendeeId: parsedAttendeeId, ownerId: parsedOwnerId });
  if (!updated) {
    return { success: false, status: 404, error: "Attendee not found or already marked" };
  }

  const userId = updated.user_id;

  const updatedUser = await UserModel.incrementNoShowCount(db, userId);
  const noShowCount = updatedUser?.no_show_count ?? 0;

  let bannedUntilLabel = null;
  if (noShowCount >= NO_SHOW_BAN_THRESHOLD) {
    const banDate = new Date();
    banDate.setDate(banDate.getDate() + NO_SHOW_BAN_DAYS);
    await UserModel.setBannedUntil(db, userId, banDate.toISOString().slice(0, 10));
    bannedUntilLabel = banDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  const user = await UserModel.findById(db, userId);
  if (user?.email) {
    try {
      if (bannedUntilLabel) {
        await sendNoShowBanEmail({ to: user.email, userName: user.full_name || "Guest", bannedUntilLabel });
      } else if (noShowCount === NO_SHOW_BAN_THRESHOLD - 1) {
        await sendNoShowWarningEmail({ to: user.email, userName: user.full_name || "Guest" });
      }
    } catch (emailError) {
      console.warn("Failed to send event no-show email:", emailError.message);
    }
  }

  return {
    success: true,
    status: 200,
    noShowCount,
    banned: !!bannedUntilLabel,
    bannedUntilLabel,
  };
};

const markEventAttendeeCompleted = async ({ attendeeId, ownerId }) => {
  const parsedAttendeeId = parseInt(attendeeId, 10);
  const parsedOwnerId = parseInt(ownerId, 10);

  if (Number.isNaN(parsedAttendeeId)) {
    return { success: false, status: 400, error: "Invalid attendee ID" };
  }

  const updated = await eventRepository.markEventAttendeeCompleted({ attendeeId: parsedAttendeeId, ownerId: parsedOwnerId });
  if (!updated) {
    return { success: false, status: 404, error: "Attendee not found or already marked" };
  }

  return { success: true, status: 200, data: updated };
};

module.exports = {
  createOwnerEvent,
  getOwnerEvents,
  updateOwnerEvent,
  deleteOwnerEvent,
  getPublicEvents,
  getRestaurantPublicEvents,
  getOwnerEventAttendees,
  joinEvent,
  saveEvent,
  unsaveEvent,
  getSavedEvents,
  getUserEventReservations,
  cancelUserEventReservation,
  getOwnerEventReservations,
  deleteOwnerEventReservation,
  markEventAttendeeNoShow,
  markEventAttendeeCompleted,
};
