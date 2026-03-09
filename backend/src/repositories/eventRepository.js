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
        e.start_date,
        e.end_date,
        e.is_active,
        e.created_at,
        e.updated_at
      FROM events e
      JOIN restaurants r ON r.id = e.restaurant_id
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
        e.start_date,
        e.end_date,
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
  isActive = true,
}) => {
  const result = await pool.query(
    `
      INSERT INTO events (
        restaurant_id,
        title,
        description,
        image_url,
        event_date,
        start_date,
        end_date,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $5, $6, $7)
      RETURNING
        id,
        restaurant_id,
        title,
        description,
        image_url,
        start_date,
        end_date,
        is_active,
        created_at,
        updated_at
    `,
    [restaurantId, title, description, imageUrl, startDate, endDate, isActive]
  );
  return result.rows[0] || null;
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
        e.start_date,
        e.end_date,
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
        e.start_date,
        e.end_date,
        e.is_active,
        ${distanceSql.sql}
      FROM events e
      JOIN restaurants r ON r.id = e.restaurant_id
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
        e.start_date,
        e.end_date,
        e.is_active,
        e.created_at,
        e.updated_at
      FROM events e
      JOIN restaurants r ON r.id = e.restaurant_id
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

module.exports = {
  getOwnedRestaurantById,
  getOwnerEvents,
  getOwnerEventById,
  createOwnerEvent,
  updateOwnerEvent,
  deleteOwnerEvent,
  getPublicEvents,
  getPublicEventsByRestaurantId,
};
