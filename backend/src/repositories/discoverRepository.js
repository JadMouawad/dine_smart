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

const buildRadiusCondition = ({ hasCoords, radiusParam = null, latParam = "$1", lngParam = "$2" }) => {
  if (!hasCoords || !radiusParam) return "";
  return `
    AND (
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
    ) <= ${radiusParam}
  `;
};

const getCommonRestaurantSelect = (distanceSql) => `
  r.id,
  r.name,
  r.cuisine,
  r.address,
  r.rating,
  r.price_range,
  r.latitude,
  r.longitude,
  r.opening_time,
  r.closing_time,
  ${distanceSql},
  COALESCE(ev.active_event_count, 0) AS active_event_count
`;

const getNearYou = async ({ latitude = null, longitude = null, radiusKm = null, limit = 8 }) => {
  const distance = buildDistanceSelect(latitude, longitude, 1);
  const values = [...distance.values];
  let idx = distance.nextIndex;

  let radiusParam = null;
  if (radiusKm != null && latitude != null && longitude != null) {
    radiusParam = `$${idx}`;
    values.push(radiusKm);
    idx += 1;
  }

  values.push(limit);
  const limitParam = `$${idx}`;

  const result = await pool.query(
    `
      SELECT
        ${getCommonRestaurantSelect(distance.sql)}
      FROM restaurants r
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS active_event_count
        FROM events e
        WHERE e.restaurant_id = r.id
          AND e.is_active = true
          AND e.end_date >= CURRENT_DATE
      ) ev ON true
      WHERE r.is_verified = true
        AND r.approval_status = 'approved'
        ${buildRadiusCondition({
          hasCoords: latitude != null && longitude != null,
          radiusParam,
          latParam: "$1",
          lngParam: "$2",
        })}
      ORDER BY
        CASE WHEN ${latitude != null && longitude != null ? "distance_km" : "NULL"} IS NULL THEN 1 ELSE 0 END,
        distance_km ASC NULLS LAST,
        r.rating DESC
      LIMIT ${limitParam}
    `,
    values
  );

  return result.rows;
};

const getPopularRightNow = async ({ latitude = null, longitude = null, radiusKm = null, limit = 8 }) => {
  const distance = buildDistanceSelect(latitude, longitude, 1);
  const values = [...distance.values];
  let idx = distance.nextIndex;

  let radiusParam = null;
  if (radiusKm != null && latitude != null && longitude != null) {
    radiusParam = `$${idx}`;
    values.push(radiusKm);
    idx += 1;
  }

  values.push(limit);
  const limitParam = `$${idx}`;

  const result = await pool.query(
    `
      SELECT
        ${getCommonRestaurantSelect(distance.sql)},
        COALESCE(pop.recent_reservations, 0) AS recent_reservations
      FROM restaurants r
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS recent_reservations
        FROM reservations rs
        WHERE rs.restaurant_id = r.id
          AND rs.status = 'confirmed'
          AND rs.created_at >= NOW() - INTERVAL '30 days'
      ) pop ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS active_event_count
        FROM events e
        WHERE e.restaurant_id = r.id
          AND e.is_active = true
          AND e.end_date >= CURRENT_DATE
      ) ev ON true
      WHERE r.is_verified = true
        AND r.approval_status = 'approved'
        ${buildRadiusCondition({
          hasCoords: latitude != null && longitude != null,
          radiusParam,
          latParam: "$1",
          lngParam: "$2",
        })}
      ORDER BY pop.recent_reservations DESC, r.rating DESC
      LIMIT ${limitParam}
    `,
    values
  );

  return result.rows;
};

const getPreferredCuisinesByUser = async (userId, limit = 3) => {
  const result = await pool.query(
    `
      SELECT cuisine, SUM(weight)::int AS score
      FROM (
        SELECT r.cuisine, COUNT(*)::int AS weight
        FROM reservations rs
        JOIN restaurants r ON r.id = rs.restaurant_id
        WHERE rs.user_id = $1
          AND rs.status IN ('confirmed', 'completed')
          AND r.cuisine IS NOT NULL
        GROUP BY r.cuisine

        UNION ALL

        SELECT r.cuisine, COUNT(*)::int AS weight
        FROM reviews rv
        JOIN restaurants r ON r.id = rv.restaurant_id
        WHERE rv.user_id = $1
          AND r.cuisine IS NOT NULL
        GROUP BY r.cuisine
      ) src
      GROUP BY cuisine
      ORDER BY score DESC, cuisine ASC
      LIMIT $2
    `,
    [userId, limit]
  );
  return result.rows.map((row) => row.cuisine).filter(Boolean);
};

const getMatchesPreferences = async ({
  preferredCuisines = [],
  latitude = null,
  longitude = null,
  radiusKm = null,
  limit = 8,
}) => {
  if (!preferredCuisines.length) return [];

  const distance = buildDistanceSelect(latitude, longitude, 2);
  const values = [preferredCuisines, ...distance.values];
  let idx = distance.nextIndex;

  let radiusParam = null;
  if (radiusKm != null && latitude != null && longitude != null) {
    radiusParam = `$${idx}`;
    values.push(radiusKm);
    idx += 1;
  }

  values.push(limit);
  const limitParam = `$${idx}`;

  const result = await pool.query(
    `
      SELECT
        ${getCommonRestaurantSelect(distance.sql)}
      FROM restaurants r
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS active_event_count
        FROM events e
        WHERE e.restaurant_id = r.id
          AND e.is_active = true
          AND e.end_date >= CURRENT_DATE
      ) ev ON true
      WHERE r.is_verified = true
        AND r.approval_status = 'approved'
        AND r.cuisine = ANY($1::text[])
        ${buildRadiusCondition({
          hasCoords: latitude != null && longitude != null,
          radiusParam,
          latParam: "$2",
          lngParam: "$3",
        })}
      ORDER BY r.rating DESC, distance_km ASC NULLS LAST
      LIMIT ${limitParam}
    `,
    values
  );

  return result.rows;
};

const getUpcomingEventsNearby = async ({ latitude = null, longitude = null, radiusKm = null, limit = 8 }) => {
  const distance = buildDistanceSelect(latitude, longitude, 1);
  const values = [...distance.values];
  let idx = distance.nextIndex;

  let radiusParam = null;
  if (radiusKm != null && latitude != null && longitude != null) {
    radiusParam = `$${idx}`;
    values.push(radiusKm);
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
        ${distance.sql}
      FROM events e
      JOIN restaurants r ON r.id = e.restaurant_id
      WHERE r.is_verified = true
        AND r.approval_status = 'approved'
        AND e.is_active = true
        AND e.end_date >= CURRENT_DATE
        ${buildRadiusCondition({
          hasCoords: latitude != null && longitude != null,
          radiusParam,
          latParam: "$1",
          lngParam: "$2",
        })}
      ORDER BY e.start_date ASC, distance_km ASC NULLS LAST
      LIMIT ${limitParam}
    `,
    values
  );
  return result.rows;
};

const getHighlyRated = async ({ latitude = null, longitude = null, radiusKm = null, limit = 8 }) => {
  const distance = buildDistanceSelect(latitude, longitude, 1);
  const values = [...distance.values];
  let idx = distance.nextIndex;

  let radiusParam = null;
  if (radiusKm != null && latitude != null && longitude != null) {
    radiusParam = `$${idx}`;
    values.push(radiusKm);
    idx += 1;
  }

  values.push(limit);
  const limitParam = `$${idx}`;

  const result = await pool.query(
    `
      SELECT
        ${getCommonRestaurantSelect(distance.sql)}
      FROM restaurants r
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS active_event_count
        FROM events e
        WHERE e.restaurant_id = r.id
          AND e.is_active = true
          AND e.end_date >= CURRENT_DATE
      ) ev ON true
      WHERE r.is_verified = true
        AND r.approval_status = 'approved'
        AND COALESCE(r.rating, 0) >= 4
        ${buildRadiusCondition({
          hasCoords: latitude != null && longitude != null,
          radiusParam,
          latParam: "$1",
          lngParam: "$2",
        })}
      ORDER BY r.rating DESC, distance_km ASC NULLS LAST
      LIMIT ${limitParam}
    `,
    values
  );
  return result.rows;
};

module.exports = {
  getNearYou,
  getPopularRightNow,
  getPreferredCuisinesByUser,
  getMatchesPreferences,
  getUpcomingEventsNearby,
  getHighlyRated,
};
