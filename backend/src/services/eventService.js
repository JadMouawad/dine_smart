const eventRepository = require("../repositories/eventRepository");

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

  const description = payload.description != null ? String(payload.description).trim() : null;
  const imageUrl = payload.image_url != null ? String(payload.image_url).trim() : null;

  const dateValidation = validateDateRange(payload.start_date, payload.end_date);
  if (dateValidation.error) {
    return { success: false, status: 400, error: dateValidation.error };
  }

  const ownershipCheck = await assertOwnerCanPublish({
    ownerId,
    restaurantId: payload.restaurant_id,
  });
  if (!ownershipCheck.success) return ownershipCheck;

  const created = await eventRepository.createOwnerEvent({
    restaurantId: ownershipCheck.restaurant.id,
    title,
    description,
    imageUrl,
    startDate: dateValidation.start,
    endDate: dateValidation.end,
    isActive: parseBoolean(payload.is_active, true),
  });

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
  if (payload.is_active != null) {
    const parsed = parseBoolean(payload.is_active, null);
    if (parsed == null) return { success: false, status: 400, error: "is_active must be true or false" };
    updates.is_active = parsed;
  }

  const startDateInput = payload.start_date ?? existing.start_date;
  const endDateInput = payload.end_date ?? existing.end_date;
  if (payload.start_date != null || payload.end_date != null) {
    const dateValidation = validateDateRange(startDateInput, endDateInput);
    if (dateValidation.error) {
      return { success: false, status: 400, error: dateValidation.error };
    }
    updates.start_date = dateValidation.start;
    updates.end_date = dateValidation.end;
  }

  if (Object.keys(updates).length === 0) {
    return { success: true, status: 200, data: existing };
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

module.exports = {
  createOwnerEvent,
  getOwnerEvents,
  updateOwnerEvent,
  deleteOwnerEvent,
  getPublicEvents,
  getRestaurantPublicEvents,
};
