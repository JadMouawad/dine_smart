const pool = require("../config/db");

const buildDistanceSql = (latitude, longitude, startIndex = 1) => {
  if (latitude == null || longitude == null) {
    return {
      sql: "NULL::numeric AS distance_km",
      values: [],
      nextIndex: startIndex,
    };
  }

  const latParam = `$${startIndex}`;
  const lngParam = `$${startIndex + 1}`;
  return {
    sql: `
      (
        6371 * ACOS(
          LEAST(
            1,
            GREATEST(
              -1,
              COS(RADIANS(${latParam})) * COS(RADIANS(r.latitude)) * COS(RADIANS(r.longitude) - RADIANS(${lngParam}))
              + SIN(RADIANS(${latParam})) * SIN(RADIANS(r.latitude))
            )
          )
        )
      )::numeric(10,2) AS distance_km
    `,
    values: [latitude, longitude],
    nextIndex: startIndex + 2,
  };
};

const getOwnedRestaurantById = async ({ ownerId, restaurantId }) => {
  const result = await pool.query(
    `
      SELECT id, owner_id, name, is_verified, approval_status
      FROM restaurants
      WHERE id = $1
        AND owner_id = $2
      LIMIT 1
    `,
    [restaurantId, ownerId]
  );
  return result.rows[0] || null;
};

const getOwnerEvents = async (ownerId) => {
  const result = await pool.query(
    `
      SELECT
        e.id,
        e.restaurant_id,
        r.name AS restaurant_name,
        e.title,
        e.description,
        e.image_url,
        e.start_date::text AS start_date,
        e.end_date::text AS end_date,
        e.start_time::text AS start_time,
        e.end_time::text AS end_time,
        e.max_attendees,
        e.is_free,
        e.price,
        e.tags,
        e.location_override,
        COALESCE(att.going_count, 0) AS going_count,
        e.is_active,
        e.created_at,
        e.updated_at
      FROM events e
      JOIN restaurants r ON r.id = e.restaurant_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(attendees_count), 0)::int AS going_count
        FROM event_attendees ea
        WHERE ea.event_id = e.id
          AND ea.status = 'confirmed'
          AND ea.status = 'confirmed'
      ) att ON true
      WHERE r.owner_id = $1
      ORDER BY e.start_date DESC, e.created_at DESC
    `,
    [ownerId]
  );
  return result.rows;
};

const getOwnerEventById = async ({ ownerId, eventId }) => {
  const result = await pool.query(
    `
      SELECT
        e.id,
        e.restaurant_id,
        r.name AS restaurant_name,
        r.owner_id,
        r.is_verified,
        r.approval_status,
        e.title,
        e.description,
        e.image_url,
        e.start_date::text AS start_date,
        e.end_date::text AS end_date,
        e.start_time::text AS start_time,
        e.end_time::text AS end_time,
        e.max_attendees,
        e.is_free,
        e.price,
        e.tags,
        e.location_override,
        e.is_active,
        e.created_at,
        e.updated_at
      FROM events e
      JOIN restaurants r ON r.id = e.restaurant_id
      WHERE e.id = $1
        AND r.owner_id = $2
      LIMIT 1
    `,
    [eventId, ownerId]
  );
  return result.rows[0] || null;
};

const createOwnerEvent = async ({
  restaurantId,
  title,
  description,
  imageUrl,
  startDate,
  endDate,
  startTime,
  endTime,
  maxAttendees,
  isFree,
  price,
  tags,
  locationOverride,
  isActive = true,
}, db = pool) => {
  const result = await db.query(
    `
      INSERT INTO events (
        restaurant_id,
        title,
        description,
        image_url,
        event_date,
        start_date,
        end_date,
        start_time,
        end_time,
        max_attendees,
        is_free,
        price,
        tags,
        location_override,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING
        id,
        restaurant_id,
        title,
        description,
        image_url,
        start_date::text AS start_date,
        end_date::text AS end_date,
        start_time::text AS start_time,
        end_time::text AS end_time,
        max_attendees,
        is_free,
        price,
        tags,
        location_override,
        is_active,
        created_at,
        updated_at
    `,
    [
      restaurantId,
      title,
      description,
      imageUrl,
      startDate, // event_date
      startDate, // start_date
      endDate,   // end_date
      startTime,
      endTime,
      maxAttendees,
      isFree,
      price,
      tags,
      locationOverride,
      isActive,
    ]
  );
  return result.rows[0] || null;
};

const getConflictingReservationsForOwnerEvent = async ({
  restaurantId,
  startDate,
  endDate,
  startTime,
  endTime,
}, db = pool) => {
  const result = await db.query(
    `
      SELECT
        r.id,
        r.user_id,
        r.restaurant_id,
        r.reservation_date::text AS reservation_date,
        r.reservation_time::text AS reservation_time,
        r.party_size,
        r.seating_preference,
        r.special_request,
        r.status,
        r.confirmation_id,
        r.duration_minutes,
        r.created_at,
        r.updated_at,
        rest.name AS restaurant_name,
        u.full_name AS customer_name,
        u.email AS customer_email
      FROM reservations r
      JOIN restaurants rest ON rest.id = r.restaurant_id
      JOIN users u ON u.id = r.user_id
      WHERE r.restaurant_id = $1
        AND r.status IN ('pending', 'accepted', 'confirmed')
        AND ((r.reservation_date::date + r.reservation_time) < ($4::date + $5::time))
        AND ((r.reservation_date::date + r.reservation_time + make_interval(mins => COALESCE(r.duration_minutes, 120))) > ($2::date + $3::time))
      ORDER BY r.reservation_date ASC, r.reservation_time ASC, r.created_at ASC
    `,
    [restaurantId, startDate, startTime, endDate, endTime]
  );
  return result.rows;
};

const updateOwnerEvent = async ({ ownerId, eventId, updates }) => {
  const fields = [];
  const values = [];
  let idx = 1;

  const fieldMap = {
    title: "title",
    description: "description",
    image_url: "image_url",
    start_date: "start_date",
    end_date: "end_date",
    start_time: "start_time",
    end_time: "end_time",
    max_attendees: "max_attendees",
    is_free: "is_free",
    price: "price",
    tags: "tags",
    location_override: "location_override",
    is_active: "is_active",
  };

  Object.entries(updates).forEach(([key, value]) => {
    const dbField = fieldMap[key];
    if (!dbField) return;
    fields.push(`${dbField} = $${idx}`);
    values.push(value);
    idx += 1;
  });

  if (Object.prototype.hasOwnProperty.call(updates, "start_date")) {
    fields.push(`event_date = $${idx}`);
    values.push(updates.start_date);
    idx += 1;
  }

  if (fields.length === 0) return null;

  fields.push("updated_at = NOW()");
  values.push(eventId, ownerId);

  const result = await pool.query(
    `
      UPDATE events e
      SET ${fields.join(", ")}
      FROM restaurants r
      WHERE e.restaurant_id = r.id
        AND e.id = $${idx}
        AND r.owner_id = $${idx + 1}
      RETURNING
        e.id,
        e.restaurant_id,
        e.title,
        e.description,
        e.image_url,
        e.start_date::text AS start_date,
        e.end_date::text AS end_date,
        e.start_time::text AS start_time,
        e.end_time::text AS end_time,
        e.max_attendees,
        e.is_free,
        e.price,
        e.tags,
        e.location_override,
        e.is_active,
        e.created_at,
        e.updated_at
    `,
    values
  );
  return result.rows[0] || null;
};

const deleteOwnerEvent = async ({ ownerId, eventId }) => {
  const result = await pool.query(
    `
      DELETE FROM events e
      USING restaurants r
      WHERE e.restaurant_id = r.id
        AND e.id = $1
        AND r.owner_id = $2
      RETURNING e.id, e.restaurant_id
    `,
    [eventId, ownerId]
  );
  return result.rows[0] || null;
};

const getPublicEvents = async ({ latitude = null, longitude = null, distanceRadius = null, limit = 40 }) => {
  const values = [];
  const distanceSql = buildDistanceSql(latitude, longitude, 1);
  values.push(...distanceSql.values);
  let idx = distanceSql.nextIndex;

  const conditions = [
    "r.is_verified = true",
    "r.approval_status = 'approved'",
    "e.is_active = true",
    "e.end_date >= CURRENT_DATE",
  ];

  if (distanceRadius != null && latitude != null && longitude != null) {
    const radiusParam = `$${idx}`;
    conditions.push(`
      (
        6371 * ACOS(
          LEAST(
            1,
            GREATEST(
              -1,
              COS(RADIANS($1)) * COS(RADIANS(r.latitude)) * COS(RADIANS(r.longitude) - RADIANS($2))
              + SIN(RADIANS($1)) * SIN(RADIANS(r.latitude))
            )
          )
        )
      ) <= ${radiusParam}
    `);
    values.push(distanceRadius);
    idx += 1;
  }

  values.push(limit);
  const limitParam = `$${idx}`;

  const result = await pool.query(
    `
      SELECT
        e.id,
        e.restaurant_id,
        r.name AS restaurant_name,
        r.cuisine,
        r.rating,
        r.latitude,
        r.longitude,
        e.title,
        e.description,
        e.image_url,
        e.start_date::text AS start_date,
        e.end_date::text AS end_date,
        e.start_time::text AS start_time,
        e.end_time::text AS end_time,
        e.max_attendees,
        e.is_free,
        e.price,
        e.tags,
        e.location_override,
        e.is_active,
        COALESCE(att.going_count, 0) AS going_count,
        ${distanceSql.sql}
      FROM events e
      JOIN restaurants r ON r.id = e.restaurant_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(attendees_count), 0)::int AS going_count
        FROM event_attendees ea
        WHERE ea.event_id = e.id
          AND ea.status = 'confirmed'
      ) att ON true
      WHERE ${conditions.join(" AND ")}
      ORDER BY e.start_date ASC, e.created_at DESC
      LIMIT ${limitParam}
    `,
    values
  );
  return result.rows;
};

const getPublicEventsByRestaurantId = async (restaurantId) => {
  const result = await pool.query(
    `
      SELECT
        e.id,
        e.restaurant_id,
        e.title,
        e.description,
        e.image_url,
        e.start_date::text AS start_date,
        e.end_date::text AS end_date,
        e.start_time::text AS start_time,
        e.end_time::text AS end_time,
        e.max_attendees,
        e.is_free,
        e.price,
        e.tags,
        e.location_override,
        e.is_active,
        COALESCE(att.going_count, 0) AS going_count,
        e.created_at,
        e.updated_at
      FROM events e
      JOIN restaurants r ON r.id = e.restaurant_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(attendees_count), 0)::int AS going_count
        FROM event_attendees ea
        WHERE ea.event_id = e.id
          AND ea.status = 'confirmed'
      ) att ON true
      WHERE e.restaurant_id = $1
        AND r.is_verified = true
        AND r.approval_status = 'approved'
        AND e.is_active = true
      ORDER BY e.start_date ASC, e.created_at DESC
    `,
    [restaurantId]
  );
  return result.rows;
};

const getPublicEventById = async (eventId, db = pool) => {
  const result = await db.query(
    `
      SELECT
        e.id,
        e.restaurant_id,
        r.name AS restaurant_name,
        r.latitude,
        r.longitude,
        e.title,
        e.description,
        e.image_url,
        e.start_date::text AS start_date,
        e.end_date::text AS end_date,
        e.start_time::text AS start_time,
        e.end_time::text AS end_time,
        e.max_attendees,
        e.is_free,
        e.price,
        e.tags,
        e.location_override,
        e.is_active,
        COALESCE(att.going_count, 0) AS going_count
      FROM events e
      JOIN restaurants r ON r.id = e.restaurant_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(attendees_count), 0)::int AS going_count
        FROM event_attendees ea
        WHERE ea.event_id = e.id
          AND ea.status = 'confirmed'
      ) att ON true
      WHERE e.id = $1
        AND r.is_verified = true
        AND r.approval_status = 'approved'
        AND e.is_active = true
        AND e.end_date >= CURRENT_DATE
      LIMIT 1
    `,
    [eventId]
  );
  return result.rows[0] || null;
};

const getEventCapacitySummary = async ({ eventId }, db = pool) => {
  const result = await db.query(
    `
      SELECT
        e.id,
        e.max_attendees,
        COALESCE(SUM(CASE WHEN ea.status = 'confirmed' THEN ea.attendees_count ELSE 0 END), 0)::int AS booked
      FROM events e
      LEFT JOIN event_attendees ea ON ea.event_id = e.id
      WHERE e.id = $1
      GROUP BY e.id
    `,
    [eventId]
  );
  return result.rows[0] || null;
};

const getEventAttendeeByUser = async ({ eventId, userId }, db = pool) => {
  const result = await db.query(
    `
      SELECT id, attendees_count, status
      FROM event_attendees
      WHERE event_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [eventId, userId]
  );
  return result.rows[0] || null;
};

const getOwnerEventAttendees = async ({ ownerId, eventId }, db = pool) => {
  const result = await db.query(
    `
      SELECT
        ea.id,
        ea.event_id,
        ea.user_id,
        u.full_name,
        u.email,
        u.phone,
        ea.attendees_count,
        ea.status,
        ea.created_at
      FROM event_attendees ea
      JOIN events e ON e.id = ea.event_id
      JOIN restaurants r ON r.id = e.restaurant_id
      JOIN users u ON u.id = ea.user_id
      WHERE e.id = $1
        AND r.owner_id = $2
      ORDER BY ea.created_at DESC
    `,
    [eventId, ownerId]
  );
  return result.rows;
};

const upsertEventAttendee = async ({ eventId, userId, attendeesCount, seatingPreference, notes }, db = pool) => {
  const result = await db.query(
    `
      INSERT INTO event_attendees (
        event_id,
        user_id,
        attendees_count,
        seating_preference,
        notes,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'confirmed')
      ON CONFLICT (event_id, user_id)
      DO UPDATE SET
        attendees_count = EXCLUDED.attendees_count,
        seating_preference = EXCLUDED.seating_preference,
        notes = EXCLUDED.notes,
        status = 'confirmed',
        updated_at = NOW()
      RETURNING id, event_id, user_id, attendees_count, seating_preference, notes, created_at, updated_at
    `,
    [eventId, userId, attendeesCount, seatingPreference, notes]
  );
  return result.rows[0] || null;
};

const createEventAttendee = async ({ eventId, userId, attendeesCount, seatingPreference, notes }, db = pool) => {
  const result = await db.query(
    `
      INSERT INTO event_attendees (
        event_id,
        user_id,
        attendees_count,
        seating_preference,
        notes,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'confirmed')
      RETURNING id, event_id, user_id, attendees_count, seating_preference, notes, status, created_at, updated_at
    `,
    [eventId, userId, attendeesCount, seatingPreference, notes]
  );
  return result.rows[0] || null;
};

const cancelEventAttendeeByUser = async ({ eventId, userId }, db = pool) => {
  const result = await db.query(
    `
      UPDATE event_attendees
      SET status = 'cancelled', updated_at = NOW()
      WHERE event_id = $1 AND user_id = $2 AND status = 'confirmed'
      RETURNING id, event_id, user_id, attendees_count, status, created_at, updated_at
    `,
    [eventId, userId]
  );
  return result.rows[0] || null;
};

const getUserEventReservations = async ({ userId }, db = pool) => {
  const result = await db.query(
    `
      SELECT
        ea.id,
        ea.event_id,
        ea.user_id,
        ea.attendees_count,
        ea.status,
        ea.created_at,
        e.title AS event_title,
        e.event_date::text AS event_date,
        e.start_date::text AS start_date,
        e.end_date::text AS end_date,
        e.start_time::text AS start_time,
        e.end_time::text AS end_time,
        r.name AS restaurant_name
      FROM event_attendees ea
      JOIN events e ON e.id = ea.event_id
      JOIN restaurants r ON r.id = e.restaurant_id
      WHERE ea.user_id = $1
      ORDER BY e.start_date DESC, e.start_time DESC, ea.created_at DESC
    `,
    [userId]
  );
  return result.rows;
};

const getUserUpcomingEventReservations = async ({ userId }, db = pool) => {
  const result = await db.query(
    `
      SELECT
        ea.id,
        ea.event_id,
        ea.user_id,
        ea.attendees_count,
        ea.status,
        e.title AS event_title,
        e.event_date::text AS event_date,
        e.start_date::text AS start_date,
        e.end_date::text AS end_date,
        e.start_time::text AS start_time,
        e.end_time
      FROM event_attendees ea
      JOIN events e ON e.id = ea.event_id
      WHERE ea.user_id = $1
        AND ea.status = 'confirmed'
        AND e.end_date >= CURRENT_DATE
      ORDER BY e.start_date ASC, e.start_time ASC, ea.created_at ASC
    `,
    [userId]
  );
  return result.rows;
};

const getOwnerEventReservations = async ({ ownerId }, db = pool) => {
  const result = await db.query(
    `
      SELECT
        ea.id,
        ea.event_id,
        ea.user_id,
        ea.attendees_count,
        ea.status,
        ea.created_at,
        u.full_name AS user_name,
        u.email AS user_email,
        e.title AS event_title,
        e.event_date::text AS event_date,
        e.start_date::text AS start_date,
        e.end_date::text AS end_date,
        e.start_time::text AS start_time,
        e.end_time::text AS end_time,
        r.name AS restaurant_name
      FROM event_attendees ea
      JOIN events e ON e.id = ea.event_id
      JOIN restaurants r ON r.id = e.restaurant_id
      JOIN users u ON u.id = ea.user_id
      WHERE r.owner_id = $1
      ORDER BY e.start_date DESC, e.start_time DESC, ea.created_at DESC
    `,
    [ownerId]
  );
  return result.rows;
};

const getOwnerEventReservationById = async ({ ownerId, reservationId }, db = pool) => {
  const result = await db.query(
    `
      SELECT
        ea.id,
        ea.event_id,
        ea.user_id,
        ea.attendees_count,
        ea.status,
        ea.created_at,
        e.title AS event_title,
        e.event_date::text AS event_date,
        e.start_date::text AS start_date,
        e.end_date::text AS end_date,
        e.start_time::text AS start_time,
        e.end_time::text AS end_time,
        r.name AS restaurant_name
      FROM event_attendees ea
      JOIN events e ON e.id = ea.event_id
      JOIN restaurants r ON r.id = e.restaurant_id
      WHERE ea.id = $1
        AND r.owner_id = $2
      LIMIT 1
    `,
    [reservationId, ownerId]
  );
  return result.rows[0] || null;
};

const deleteEventReservationById = async ({ reservationId }, db = pool) => {
  const result = await db.query(
    `
      DELETE FROM event_attendees
      WHERE id = $1
      RETURNING id
    `,
    [reservationId]
  );
  return result.rows[0] || null;
};

const saveEventForUser = async ({ eventId, userId }) => {
  await pool.query(
    `
      INSERT INTO saved_events (user_id, event_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, event_id) DO NOTHING
    `,
    [userId, eventId]
  );
  return true;
};

const removeSavedEventForUser = async ({ eventId, userId }) => {
  const result = await pool.query(
    `
      DELETE FROM saved_events
      WHERE user_id = $1 AND event_id = $2
      RETURNING event_id
    `,
    [userId, eventId]
  );
  return result.rowCount > 0;
};

const getSavedEventsByUser = async ({ userId }) => {
  const result = await pool.query(
    `
      SELECT
        e.id,
        e.restaurant_id,
        r.name AS restaurant_name,
        r.latitude,
        r.longitude,
        e.title,
        e.description,
        e.image_url,
        e.start_date::text AS start_date,
        e.end_date::text AS end_date,
        e.is_active,
        COALESCE(att.going_count, 0) AS going_count,
        se.created_at AS saved_at
      FROM saved_events se
      JOIN events e ON e.id = se.event_id
      JOIN restaurants r ON r.id = e.restaurant_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(attendees_count), 0)::int AS going_count
        FROM event_attendees ea
        WHERE ea.event_id = e.id
      ) att ON true
      WHERE se.user_id = $1
        AND r.is_verified = true
        AND r.approval_status = 'approved'
      ORDER BY se.created_at DESC
    `,
    [userId]
  );
  return result.rows;
};

module.exports = {
  getOwnedRestaurantById,
  getOwnerEvents,
  getOwnerEventById,
  createOwnerEvent,
  getConflictingReservationsForOwnerEvent,
  updateOwnerEvent,
  deleteOwnerEvent,
  getPublicEvents,
  getPublicEventsByRestaurantId,
  getPublicEventById,
  getEventCapacitySummary,
  getEventAttendeeByUser,
  getOwnerEventAttendees,
  upsertEventAttendee,
  createEventAttendee,
  cancelEventAttendeeByUser,
  getUserEventReservations,
  getUserUpcomingEventReservations,
  getOwnerEventReservations,
  getOwnerEventReservationById,
  deleteEventReservationById,
  saveEventForUser,
  removeSavedEventForUser,
  getSavedEventsByUser,
};
