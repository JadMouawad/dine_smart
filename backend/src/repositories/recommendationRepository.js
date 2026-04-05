const pool = require("../config/db");

const buildDistanceSelect = (latitude, longitude, startIndex = 1) => {
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

const getUserReviewHistory = async (userId, limit = 40) => {
  const result = await pool.query(
    `
      SELECT
        rv.restaurant_id,
        rv.rating,
        rv.comment,
        rv.created_at,
        r.name AS restaurant_name,
        r.cuisine,
        r.price_range
      FROM reviews rv
      JOIN restaurants r ON r.id = rv.restaurant_id
      WHERE rv.user_id = $1
      ORDER BY rv.created_at DESC
      LIMIT $2
    `,
    [userId, limit]
  );
  return result.rows;
};

const getUserFavoriteHistory = async (userId, limit = 40) => {
  const result = await pool.query(
    `
      SELECT
        uf.restaurant_id,
        uf.created_at,
        r.name AS restaurant_name,
        r.cuisine,
        r.price_range,
        r.rating
      FROM user_favorites uf
      JOIN restaurants r ON r.id = uf.restaurant_id
      WHERE uf.user_id = $1
      ORDER BY uf.created_at DESC
      LIMIT $2
    `,
    [userId, limit]
  );
  return result.rows;
};

const getUserReservationHistory = async (userId, limit = 60) => {
  const result = await pool.query(
    `
      SELECT
        rs.restaurant_id,
        rs.reservation_date::text AS reservation_date,
        rs.reservation_time::text AS reservation_time,
        rs.party_size,
        rs.status,
        rs.created_at,
        r.name AS restaurant_name,
        r.cuisine,
        r.price_range
      FROM reservations rs
      JOIN restaurants r ON r.id = rs.restaurant_id
      WHERE rs.user_id = $1
      ORDER BY rs.created_at DESC
      LIMIT $2
    `,
    [userId, limit]
  );
  return result.rows;
};

const getRecommendationCandidates = async ({
  cuisines = [],
  priceRanges = [],
  excludeRestaurantIds = [],
  latitude = null,
  longitude = null,
  limit = 24,
}) => {
  const distance = buildDistanceSelect(latitude, longitude, 1);
  const values = [...distance.values];
  let idx = distance.nextIndex;

  const conditions = [
    "r.is_verified = true",
    "r.approval_status = 'approved'",
  ];

  if (excludeRestaurantIds.length > 0) {
    conditions.push(`r.id <> ALL($${idx}::int[])`);
    values.push(excludeRestaurantIds);
    idx += 1;
  }

  if (cuisines.length > 0) {
    conditions.push(`r.cuisine = ANY($${idx}::text[])`);
    values.push(cuisines);
    idx += 1;
  }

  if (priceRanges.length > 0) {
    conditions.push(`r.price_range = ANY($${idx}::text[])`);
    values.push(priceRanges);
    idx += 1;
  }

  values.push(limit);
  const limitParam = `$${idx}`;

  const result = await pool.query(
    `
      SELECT
        r.id,
        r.name,
        r.cuisine,
        r.price_range,
        r.rating,
        r.address,
        r.description,
        ${distance.sql},
        COALESCE(pop.recent_reservations, 0) AS recent_reservations
      FROM restaurants r
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS recent_reservations
        FROM reservations rs
        WHERE rs.restaurant_id = r.id
          AND rs.status IN ('accepted', 'confirmed', 'completed')
          AND rs.created_at >= NOW() - INTERVAL '60 days'
      ) pop ON true
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        COALESCE(r.rating, 0) DESC,
        COALESCE(pop.recent_reservations, 0) DESC,
        distance_km ASC NULLS LAST
      LIMIT ${limitParam}
    `,
    values
  );

  return result.rows;
};

const getPopularFallback = async ({
  excludeRestaurantIds = [],
  latitude = null,
  longitude = null,
  limit = 8,
}) => {
  const distance = buildDistanceSelect(latitude, longitude, 1);
  const values = [...distance.values];
  let idx = distance.nextIndex;

  const conditions = [
    "r.is_verified = true",
    "r.approval_status = 'approved'",
  ];

  if (excludeRestaurantIds.length > 0) {
    conditions.push(`r.id <> ALL($${idx}::int[])`);
    values.push(excludeRestaurantIds);
    idx += 1;
  }

  values.push(limit);
  const limitParam = `$${idx}`;

  const result = await pool.query(
    `
      SELECT
        r.id,
        r.name,
        r.cuisine,
        r.price_range,
        r.rating,
        r.address,
        r.description,
        ${distance.sql},
        COALESCE(pop.recent_reservations, 0) AS recent_reservations
      FROM restaurants r
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS recent_reservations
        FROM reservations rs
        WHERE rs.restaurant_id = r.id
          AND rs.status IN ('accepted', 'confirmed', 'completed')
          AND rs.created_at >= NOW() - INTERVAL '60 days'
      ) pop ON true
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        COALESCE(pop.recent_reservations, 0) DESC,
        COALESCE(r.rating, 0) DESC,
        distance_km ASC NULLS LAST
      LIMIT ${limitParam}
    `,
    values
  );

  return result.rows;
};

module.exports = {
  getUserReviewHistory,
  getUserFavoriteHistory,
  getUserReservationHistory,
  getRecommendationCandidates,
  getPopularFallback,
};
