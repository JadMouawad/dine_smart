// src/repositories/restaurantRepository.js
const pool = require("../config/db");

const createRestaurant = async (data) => {
  const {
    name,
    description,
    cuisine,
    address,
    phone,
    rating,
    latitude,
    longitude,
    priceRange,
    price_range: priceRangeRaw,
    dietarySupport,
    dietary_support: dietarySupportRaw,
    openingTime,
    closingTime,
    opening_time: openingTimeRaw,
    closing_time: closingTimeRaw,
    ownerId,
  } = data;
  const openingValue = openingTime || openingTimeRaw || null;
  const closingValue = closingTime || closingTimeRaw || null;
  const priceRangeValue = priceRange || priceRangeRaw || null;
  const dietarySupportValue = Array.isArray(dietarySupport)
    ? dietarySupport
    : Array.isArray(dietarySupportRaw)
      ? dietarySupportRaw
      : [];

  const result = await pool.query(
    `INSERT INTO restaurants (
      name, description, cuisine, address, opening_time, closing_time, latitude, longitude,
      price_range, dietary_support, owner_id, is_verified, approval_status
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11, false, 'pending') RETURNING *`,
    [
      name,
      description,
      cuisine,
      address,
      openingValue,
      closingValue,
      latitude != null ? Number(latitude) : null,
      longitude != null ? Number(longitude) : null,
      priceRangeValue,
      dietarySupportValue,
      ownerId,
    ]
  );
  const restaurant = result.rows[0];

  await pool.query(
    `INSERT INTO restaurant_table_configs (
      restaurant_id, total_capacity, table_2_person, table_4_person, table_6_person, indoor_capacity, outdoor_capacity
    )
    VALUES ($1, 38, 5, 5, 3, 24, 14)
    ON CONFLICT (restaurant_id) DO NOTHING`,
    [restaurant.id]
  );

  return restaurant;
};

const getAllRestaurants = async () => {
  const result = await pool.query(`
    SELECT *
    FROM restaurants
    WHERE is_verified = true
      AND approval_status = 'approved'
    ORDER BY name
  `);
  return result.rows;
};

const getRestaurantById = async (id) => {
  const result = await pool.query(`
    SELECT *
    FROM restaurants
    WHERE id = $1
      AND is_verified = true
      AND approval_status = 'approved'
  `, [id]);
  return result.rows[0];
};

const updateRestaurant = async (id, data) => {
  const fields = [];
  const values = [];
  let index = 1;
for (const key in data) {
  fields.push(`${key} = $${index}`);

  // ✅ FIX: stringify menu JSON before saving
  if (key === "menu_sections" || key === "menu") {
    values.push(JSON.stringify(data[key]));
  } else {
    values.push(data[key]);
  }

  index++;
}

  values.push(id);
  const result = await pool.query(
    `UPDATE restaurants SET ${fields.join(", ")} WHERE id = $${index} RETURNING *`,
    values
  );
  return result.rows[0];
};

const getRestaurantByOwnerId = async (ownerId) => {
  const result = await pool.query(`SELECT * FROM restaurants WHERE owner_id = $1 LIMIT 1`, [ownerId]);
  return result.rows[0] || null;
};

const getRestaurantByIdAndOwnerId = async (restaurantId, ownerId) => {
  const result = await pool.query(
    `SELECT * FROM restaurants WHERE id = $1 AND owner_id = $2 LIMIT 1`,
    [restaurantId, ownerId]
  );
  return result.rows[0] || null;
};

const deleteRestaurant = async (id) => {
  const result = await pool.query(
    `DELETE FROM restaurants WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
};

const searchRestaurants = async (query, cuisines = [], filters = {}) => {
  const trimmed = (query || "").trim();
  const cuisineList = Array.isArray(cuisines) ? cuisines.filter(Boolean) : [cuisines].filter(Boolean);

  const minRating = Number.isFinite(Number(filters.minRating)) ? Number(filters.minRating) : null;
  const priceRanges = Array.isArray(filters.priceRanges) ? filters.priceRanges.filter(Boolean) : [];
  const verifiedOnly = filters.verifiedOnly !== false;
  const dietarySupport = Array.isArray(filters.dietarySupport) ? filters.dietarySupport.filter(Boolean) : [];
  const openNow = filters.openNow === true;
  const availabilityDate = filters.availabilityDate ? String(filters.availabilityDate).trim() : null;
  const availabilityTime = filters.availabilityTime ? String(filters.availabilityTime).trim() : null;
  const latitude = Number.isFinite(Number(filters.latitude)) ? Number(filters.latitude) : null;
  const longitude = Number.isFinite(Number(filters.longitude)) ? Number(filters.longitude) : null;
  const distanceRadius = Number.isFinite(Number(filters.distanceRadius)) ? Number(filters.distanceRadius) : null;
  const onlyLebanon = filters.onlyLebanon === true;

  const values = [];
  let idx = 1;
  const conditions = [];
  const joins = [];
  const selectExtras = [];

  if (verifiedOnly) {
    conditions.push("r.is_verified = true");
    conditions.push("r.approval_status = 'approved'");
  }

  if (onlyLebanon) {
    conditions.push("r.latitude IS NOT NULL");
    conditions.push("r.longitude IS NOT NULL");
    conditions.push("r.latitude BETWEEN 33.0 AND 34.75");
    conditions.push("r.longitude BETWEEN 35.05 AND 36.7");
  }

  joins.push(`
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS active_event_count
      FROM events e
      WHERE e.restaurant_id = r.id
        AND e.is_active = true
        AND e.end_date >= CURRENT_DATE
    ) ev ON true
  `);
  selectExtras.push("COALESCE(ev.active_event_count, 0) AS active_event_count");

  const hasCoords = latitude != null && longitude != null;
  let distanceExpression = "NULL::numeric";
  if (hasCoords) {
    const latParam = `$${idx}`;
    const lngParam = `$${idx + 1}`;
    values.push(latitude, longitude);
    idx += 2;

    distanceExpression = `
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
      )::numeric(10,2)
    `;

    if (distanceRadius != null && distanceRadius > 0) {
      conditions.push(`${distanceExpression} <= $${idx}`);
      values.push(distanceRadius);
      idx += 1;
    }
  }
  selectExtras.push(`${distanceExpression} AS distance_km`);

  if (trimmed) {
    const searchPattern = `%${trimmed}%`;
    conditions.push(`(r.name ILIKE $${idx} OR r.cuisine ILIKE $${idx} OR r.description ILIKE $${idx})`);
    values.push(searchPattern);
    idx += 1;
  }

  if (cuisineList.length > 0) {
    conditions.push(`r.cuisine = ANY($${idx}::text[])`);
    values.push(cuisineList);
    idx += 1;
  }

  if (minRating != null) {
    conditions.push(`COALESCE(r.rating, 0) >= $${idx}`);
    values.push(minRating);
    idx += 1;
  }

  if (priceRanges.length > 0) {
    conditions.push(`r.price_range = ANY($${idx}::text[])`);
    values.push(priceRanges);
    idx += 1;
  }

  if (dietarySupport.length > 0) {
    conditions.push(`COALESCE(r.dietary_support, ARRAY[]::text[]) && $${idx}::text[]`);
    values.push(dietarySupport);
    idx += 1;
  }

  if (openNow) {
    conditions.push(`
      (
        NULLIF(r.opening_time, '') IS NULL
        OR NULLIF(r.closing_time, '') IS NULL
        OR (
          CASE
            WHEN NULLIF(r.opening_time, '')::time <= NULLIF(r.closing_time, '')::time
              THEN CURRENT_TIME BETWEEN NULLIF(r.opening_time, '')::time AND NULLIF(r.closing_time, '')::time
            ELSE CURRENT_TIME >= NULLIF(r.opening_time, '')::time OR CURRENT_TIME <= NULLIF(r.closing_time, '')::time
          END
        )
      )
    `);
  }

  if (availabilityDate && availabilityTime) {
    joins.push("LEFT JOIN restaurant_table_configs rtc ON rtc.restaurant_id = r.id");
    joins.push(`
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(rs.party_size), 0)::int AS booked_seats
        FROM reservations rs
        WHERE rs.restaurant_id = r.id
          AND rs.reservation_date = $${idx}
          AND rs.reservation_time = $${idx + 1}::time
          AND rs.status = 'confirmed'
      ) slot ON true
    `);
    values.push(availabilityDate, availabilityTime);
    idx += 2;

    const capacityExpression = `
      COALESCE(
        NULLIF(
          (COALESCE(rtc.table_2_person, 0) * 2)
          + (COALESCE(rtc.table_4_person, 0) * 4)
          + (COALESCE(rtc.table_6_person, 0) * 6),
          0
        ),
        rtc.total_capacity,
        0
      )
    `;
    const availableExpression = `
      CASE
        WHEN COALESCE(slot.booked_seats, 0) > 0 THEN 0
        ELSE ${capacityExpression}
      END
    `;

    selectExtras.push(`${availableExpression}::int AS available_seats`);
    conditions.push(`${availableExpression} > 0`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderBy = hasCoords
    ? "ORDER BY distance_km ASC NULLS LAST, r.rating DESC, r.name ASC"
    : "ORDER BY r.rating DESC, r.name ASC";

  const sql = `
    SELECT r.*, ${selectExtras.join(", ")}
    FROM restaurants r
    ${joins.join("\n")}
    ${whereClause}
    ${orderBy}
  `;

  const result = await pool.query(sql, values);
  return result.rows;
};

const updateRestaurantRating = async (restaurantId, rating) => {
  await pool.query(
    `UPDATE restaurants SET rating = $1, updated_at = NOW() WHERE id = $2`,
    [rating, restaurantId]
  );
};

const getTableConfigByRestaurantId = async (restaurantId) => {
  const result = await pool.query(
    `SELECT id, restaurant_id, total_capacity, table_2_person, table_4_person, table_6_person,
            indoor_capacity, outdoor_capacity, created_at, updated_at
     FROM restaurant_table_configs
     WHERE restaurant_id = $1`,
    [restaurantId]
  );
  return result.rows[0] || null;
};

const upsertTableConfigByRestaurantId = async (restaurantId, config) => {
  const {
    total_capacity,
    table_2_person,
    table_4_person,
    table_6_person,
    indoor_capacity,
    outdoor_capacity,
  } = config;

  const result = await pool.query(
    `INSERT INTO restaurant_table_configs (
      restaurant_id, total_capacity, table_2_person, table_4_person, table_6_person, indoor_capacity, outdoor_capacity
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (restaurant_id) DO UPDATE
    SET total_capacity = EXCLUDED.total_capacity,
        table_2_person = EXCLUDED.table_2_person,
        table_4_person = EXCLUDED.table_4_person,
        table_6_person = EXCLUDED.table_6_person,
        indoor_capacity = EXCLUDED.indoor_capacity,
        outdoor_capacity = EXCLUDED.outdoor_capacity,
        updated_at = NOW()
    RETURNING id, restaurant_id, total_capacity, table_2_person, table_4_person, table_6_person,
              indoor_capacity, outdoor_capacity, created_at, updated_at`,
    [
      restaurantId,
      total_capacity,
      table_2_person,
      table_4_person,
      table_6_person,
      indoor_capacity,
      outdoor_capacity,
    ]
  );
  return result.rows[0];
};

module.exports = {
  createRestaurant,
  getAllRestaurants,
  getRestaurantById,
  getRestaurantByOwnerId,
  getRestaurantByIdAndOwnerId,
  updateRestaurant,
  deleteRestaurant,
  searchRestaurants,
  updateRestaurantRating,
  getTableConfigByRestaurantId,
  upsertTableConfigByRestaurantId,
};
