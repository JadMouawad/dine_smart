// src/repositories/restaurantRepository.js
const pool = require("../config/db");

let restaurantColumnsCache = null;

const getRestaurantColumns = async () => {
  if (restaurantColumnsCache) return restaurantColumnsCache;

  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurants'
  `);

  restaurantColumnsCache = new Set(result.rows.map((row) => row.column_name));
  return restaurantColumnsCache;
};

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
    logoUrl,
    logo_url: logoUrlRaw,
    coverUrl,
    cover_url: coverUrlRaw,
    galleryUrls,
    gallery_urls: galleryUrlsRaw,
    openingTime,
    closingTime,
    opening_time: openingTimeRaw,
    closing_time: closingTimeRaw,
    ownerId,
  } = data;

  const openingValue = openingTime || openingTimeRaw || null;
  const closingValue = closingTime || closingTimeRaw || null;
  const priceRangeValue = priceRange || priceRangeRaw || null;
  const logoValue = logoUrl || logoUrlRaw || null;
  const galleryUrlsValue = (Array.isArray(galleryUrls) ? galleryUrls : (Array.isArray(galleryUrlsRaw) ? galleryUrlsRaw : []))
    .map((url) => String(url || "").trim())
    .filter(Boolean);
  const coverValue = coverUrl || coverUrlRaw || galleryUrlsValue[0] || null;
  const dietarySupportValue = Array.isArray(dietarySupport)
    ? dietarySupport
    : Array.isArray(dietarySupportRaw)
      ? dietarySupportRaw
      : [];

  const restaurantColumns = await getRestaurantColumns();
  const includeLogo = restaurantColumns.has("logo_url");
  const includeCover = restaurantColumns.has("cover_url");
  const includeGallery = restaurantColumns.has("gallery_urls");
  const includeBusinessLicenseUrl = restaurantColumns.has("business_license_url");
  const includeBusinessLicenseName = restaurantColumns.has("business_license_name");
  const includeHealthCertificateUrl = restaurantColumns.has("health_certificate_url");
  const includeHealthCertificateName = restaurantColumns.has("health_certificate_name");

  const columns = [
    "name",
    "description",
    "cuisine",
    "address",
    "opening_time",
    "closing_time",
    "latitude",
    "longitude",
    "price_range",
    "dietary_support",
    ...(includeLogo ? ["logo_url"] : []),
    ...(includeCover ? ["cover_url"] : []),
    ...(includeGallery ? ["gallery_urls"] : []),
    ...(includeBusinessLicenseUrl ? ["business_license_url"] : []),
    ...(includeBusinessLicenseName ? ["business_license_name"] : []),
    ...(includeHealthCertificateUrl ? ["health_certificate_url"] : []),
    ...(includeHealthCertificateName ? ["health_certificate_name"] : []),
    "owner_id",
    "is_verified",
    "certificate_verified",
    "approval_status",
  ];

  const values = [
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
    ...(includeLogo ? [logoValue] : []),
    ...(includeCover ? [coverValue] : []),
    ...(includeGallery ? [galleryUrlsValue] : []),
    ...(includeBusinessLicenseUrl ? [data.business_license_url || null] : []),
    ...(includeBusinessLicenseName ? [data.business_license_name || null] : []),
    ...(includeHealthCertificateUrl ? [data.health_certificate_url || null] : []),
    ...(includeHealthCertificateName ? [data.health_certificate_name || null] : []),
    ownerId,
    false,
    "pending",
  ];

  const placeholders = values.map((_, index) =>
    columns[index] === "dietary_support" || columns[index] === "gallery_urls"
      ? `$${index + 1}::text[]`
      : `$${index + 1}`
  );

  const result = await pool.query(
    `INSERT INTO restaurants (${columns.join(", ")})
     VALUES (${placeholders.join(", ")})
     RETURNING *`,
    values
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

const CUISINE_SEARCH_ALIASES = {
  Italian: ["italian", "pizza", "pasta", "risotto"],
  Japanese: ["japanese", "sushi", "ramen", "yakitori"],
  "Middle Eastern": ["middle eastern", "middle-eastern", "lebanese", "shawarma", "shawerma", "falafel", "kebbeh", "kibbeh", "mezze", "manakish", "manaeesh"],
  Mexican: ["mexican", "taco", "tacos", "burrito", "burritos"],
  American: ["american", "burger", "burgers", "bbq", "barbecue"],
  Indian: ["indian", "curry", "biryani"],
  Chinese: ["chinese", "dumpling", "dumplings"],
  Thai: ["thai", "pad thai"],
  Korean: ["korean", "bibimbap"],
  Seafood: ["seafood", "fish", "shrimp"],
  Steakhouse: ["steak", "steakhouse"],
  Breakfast: ["breakfast", "brunch"],
  International: ["international", "fusion", "global", "world cuisine", "world cuisines"],
  Vegan: ["vegan"],
  Vegetarian: ["vegetarian"],
};

const CURRENT_CROWD_SLOT_SQL = `(
  date_trunc('hour', now())
  + (floor(extract(minute from now()) / 30) * interval '30 minute')
)::time`;

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
  const crowdBaseCapacityExpression = `
    COALESCE(
      NULLIF(
        (COALESCE(crowd_rtc.table_2_person, 0) * 2)
        + (COALESCE(crowd_rtc.table_4_person, 0) * 4)
        + (COALESCE(crowd_rtc.table_6_person, 0) * 6),
        0
      ),
      crowd_rtc.total_capacity,
      0
    )
  `;
  const crowdCapacityExpression = `GREATEST(${crowdBaseCapacityExpression} + COALESCE(crowd_adj.adjustment, 0), 0)`;
  const crowdBookedExpression = `COALESCE(crowd_slot.booked_seats, 0)`;
  const crowdRatioExpression = `(${crowdBookedExpression}::numeric / NULLIF(${crowdCapacityExpression}, 0)::numeric)`;

  const result = await pool.query(`
    SELECT
      r.*,
      ${crowdCapacityExpression}::int AS crowd_total_capacity,
      ${crowdBookedExpression}::int AS crowd_booked_seats,
      CASE
        WHEN ${crowdCapacityExpression} <= 0 THEN NULL
        ELSE LEAST(100, ROUND(${crowdRatioExpression} * 100))::int
      END AS crowd_pct,
      CASE
        WHEN ${crowdCapacityExpression} <= 0 THEN 'unknown'
        WHEN ${crowdRatioExpression} >= 0.70 THEN 'busy'
        WHEN ${crowdRatioExpression} >= 0.35 THEN 'moderate'
        ELSE 'free'
      END AS crowd_level
    FROM restaurants r
    LEFT JOIN restaurant_table_configs crowd_rtc ON crowd_rtc.restaurant_id = r.id
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(rs.party_size), 0)::int AS booked_seats
      FROM reservations rs
      WHERE rs.restaurant_id = r.id
        AND rs.reservation_date = CURRENT_DATE
        AND rs.reservation_time = ${CURRENT_CROWD_SLOT_SQL}
        AND rs.status IN ('pending', 'accepted', 'confirmed')
    ) crowd_slot ON true
    LEFT JOIN reservation_slot_adjustments crowd_adj
      ON crowd_adj.restaurant_id = r.id
      AND crowd_adj.reservation_date = CURRENT_DATE
      AND crowd_adj.reservation_time = ${CURRENT_CROWD_SLOT_SQL}
      AND crowd_adj.seating_preference = 'any'
    WHERE r.id = $1
      AND r.is_verified = true
      AND r.approval_status = 'approved'
    LIMIT 1
  `, [id]);
  return result.rows[0];
};

const updateRestaurant = async (id, data) => {
  const restaurantColumns = await getRestaurantColumns();
  const allowedColumns = new Set([
    "name",
    "description",
    "cuisine",
    "address",
    "phone",
    "rating",
    "owner_id",
    "opening_time",
    "closing_time",
    "latitude",
    "longitude",
    "price_range",
    "dietary_support",
    "is_verified",
    "approval_status",
    "rejection_reason",
    "menu_sections",
    "logo_url",
    "cover_url",
    "gallery_urls",
    "business_license_url",
    "business_license_name",
    "health_certificate_url",
    "health_certificate_name",
  ]);

  const fields = [];
  const values = [];
  let index = 1;

  for (const key in data) {
    const normalizedKey = key === "menu"
      ? "menu_sections"
      : key === "galleryUrls"
        ? "gallery_urls"
        : key;
    if (!allowedColumns.has(normalizedKey)) continue;
    if (!restaurantColumns.has(normalizedKey)) continue;

    fields.push(`${normalizedKey} = $${index}`);

    if (normalizedKey === "menu_sections") {
      values.push(JSON.stringify(data[key]));
    } else if (normalizedKey === "gallery_urls") {
      const galleryUrlsValue = Array.isArray(data[key])
        ? data[key].map((url) => String(url || "").trim()).filter(Boolean)
        : [];
      values.push(galleryUrlsValue);
    } else {
      values.push(data[key]);
    }

    index += 1;
  }

  if (fields.length === 0) {
    const existing = await pool.query(`SELECT * FROM restaurants WHERE id = $1`, [id]);
    return existing.rows[0] || null;
  }

  values.push(id);
  const result = await pool.query(
    `UPDATE restaurants SET ${fields.join(", ")} WHERE id = $${index} RETURNING *`,
    values
  );
  return result.rows[0];
};

const getRestaurantByOwnerId = async (ownerId) => {
  const result = await pool.query(
    `
      SELECT *
      FROM restaurants
      WHERE owner_id = $1
      ORDER BY is_verified DESC, updated_at DESC, created_at DESC
      LIMIT 1
    `,
    [ownerId]
  );
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

const requestRestaurantDeletion = async (ownerId) => {
  const result = await pool.query(
    `UPDATE restaurants
     SET deletion_requested = TRUE, deletion_requested_at = NOW()
     WHERE owner_id = $1
     RETURNING id, name, deletion_requested, deletion_requested_at`,
    [ownerId]
  );
  return result.rows[0] || null;
};

const cancelRestaurantDeletionRequest = async (restaurantId) => {
  const result = await pool.query(
    `UPDATE restaurants
     SET deletion_requested = FALSE, deletion_requested_at = NULL
     WHERE id = $1
     RETURNING id`,
    [restaurantId]
  );
  return result.rows[0] || null;
};

const getPendingDeletionRestaurants = async () => {
  const result = await pool.query(
    `SELECT r.id, r.name, r.address, r.owner_id, r.deletion_requested_at,
            u.full_name AS owner_name, u.email AS owner_email
     FROM restaurants r
     JOIN users u ON u.id = r.owner_id
     WHERE r.deletion_requested = TRUE
     ORDER BY r.deletion_requested_at ASC`
  );
  return result.rows;
};
const searchRestaurants = async (query, cuisines = [], filters = {}) => {
  const trimmed = (query || "").trim();
  const cuisineList = Array.isArray(cuisines) ? cuisines.filter(Boolean) : [cuisines].filter(Boolean);
  const toFiniteNumberOrNull = (value) => {
    if (value == null) return null;
    if (typeof value === "string" && value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const minRating = toFiniteNumberOrNull(filters.minRating);
  const maxRating = toFiniteNumberOrNull(filters.maxRating);
  const rawPriceRanges = filters.priceRanges ?? filters.priceRange ?? [];
  const priceRanges = Array.isArray(rawPriceRanges) ? rawPriceRanges.filter(Boolean) : [];
  const approvedOnly = filters.approvedOnly !== false;
  const certificateVerifiedOnly = filters.certificateVerifiedOnly === true;
  const dietarySupport = Array.isArray(filters.dietarySupport) ? filters.dietarySupport.filter(Boolean) : [];
  const openNow = filters.openNow === true;
  const availabilityDate = filters.availabilityDate ? String(filters.availabilityDate).trim() : null;
  const availabilityTime = filters.availabilityTime ? String(filters.availabilityTime).trim() : null;
  const latitude = toFiniteNumberOrNull(filters.latitude);
  const longitude = toFiniteNumberOrNull(filters.longitude);
  const distanceRadius = toFiniteNumberOrNull(filters.distanceRadius);
  const onlyLebanon = filters.onlyLebanon === true;
  const partySize = toFiniteNumberOrNull(filters.partySize);
  const sortBy = String(filters.sortBy || "rating").trim().toLowerCase();
  const includePopularityScore = sortBy === "popularity";

  const values = [];
  let idx = 1;
  const conditions = [];
  const joins = [];
  const selectExtras = [];

  if (approvedOnly) {
    conditions.push("r.is_verified = true");
    conditions.push("r.approval_status = 'approved'");
  }

  if (certificateVerifiedOnly) {
    conditions.push("r.certificate_verified = true");
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

  joins.push(`
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS review_count
      FROM reviews rv
      WHERE rv.restaurant_id = r.id
        AND NOT EXISTS (
          SELECT 1 FROM flagged_reviews fr
          WHERE fr.review_id = rv.id
            AND (
              (
                fr.status = 'pending'
                AND COALESCE(fr.suggested_action, 'REQUIRES_REVIEW') = 'REQUIRES_REVIEW'
              )
              OR (
                fr.status = 'resolved'
                AND fr.moderator_action = 'REQUIRE_CHANGES'
                AND COALESCE(fr.resolved_at, fr.updated_at, fr.created_at) >= COALESCE(rv.updated_at, rv.created_at)
              )
            )
        )
    ) rv ON true
  `);
  selectExtras.push("COALESCE(rv.review_count, 0) AS review_count");

  if (includePopularityScore) {
    joins.push(`
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS popularity_score
        FROM reservations rp
        WHERE rp.restaurant_id = r.id
      ) pop ON true
    `);
    selectExtras.push("COALESCE(pop.popularity_score, 0) AS popularity_score");
  } else {
    selectExtras.push("0::int AS popularity_score");
  }

  // Live crowd meter joins: estimate occupancy for the current 30-min slot.
  joins.push("LEFT JOIN restaurant_table_configs crowd_rtc ON crowd_rtc.restaurant_id = r.id");
  joins.push(`
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(rs.party_size), 0)::int AS booked_seats
      FROM reservations rs
      WHERE rs.restaurant_id = r.id
        AND rs.reservation_date = CURRENT_DATE
        AND rs.reservation_time = ${CURRENT_CROWD_SLOT_SQL}
        AND rs.status IN ('pending', 'accepted', 'confirmed')
    ) crowd_slot ON true
  `);
  joins.push(`
    LEFT JOIN reservation_slot_adjustments crowd_adj
      ON crowd_adj.restaurant_id = r.id
      AND crowd_adj.reservation_date = CURRENT_DATE
      AND crowd_adj.reservation_time = ${CURRENT_CROWD_SLOT_SQL}
      AND crowd_adj.seating_preference = 'any'
  `);

  const crowdBaseCapacityExpression = `
    COALESCE(
      NULLIF(
        (COALESCE(crowd_rtc.table_2_person, 0) * 2)
        + (COALESCE(crowd_rtc.table_4_person, 0) * 4)
        + (COALESCE(crowd_rtc.table_6_person, 0) * 6),
        0
      ),
      crowd_rtc.total_capacity,
      0
    )
  `;
  const crowdCapacityExpression = `GREATEST(${crowdBaseCapacityExpression} + COALESCE(crowd_adj.adjustment, 0), 0)`;
  const crowdBookedExpression = `COALESCE(crowd_slot.booked_seats, 0)`;
  const crowdRatioExpression = `(${crowdBookedExpression}::numeric / NULLIF(${crowdCapacityExpression}, 0)::numeric)`;

  selectExtras.push(`${crowdCapacityExpression}::int AS crowd_total_capacity`);
  selectExtras.push(`${crowdBookedExpression}::int AS crowd_booked_seats`);
  selectExtras.push(`
    CASE
      WHEN ${crowdCapacityExpression} <= 0 THEN NULL
      ELSE LEAST(100, ROUND(${crowdRatioExpression} * 100))::int
    END AS crowd_pct
  `);
  selectExtras.push(`
    CASE
      WHEN ${crowdCapacityExpression} <= 0 THEN 'unknown'
      WHEN ${crowdRatioExpression} >= 0.70 THEN 'busy'
      WHEN ${crowdRatioExpression} >= 0.35 THEN 'moderate'
      ELSE 'free'
    END AS crowd_level
  `);

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
    const cleanedQuery = cleanRestaurantName(trimmed);
    const compactQuery = compactRestaurantName(cleanedQuery || trimmed);
    const namePattern = `%${trimmed}%`;
    const cleanedPattern = `%${cleanedQuery || trimmed}%`;
    const compactPattern = `%${compactQuery}%`;

    conditions.push(`(
      r.name ILIKE $${idx}
      OR COALESCE(r.cuisine, '') ILIKE $${idx}
      OR COALESCE(r.description, '') ILIKE $${idx}
      OR regexp_replace(lower(r.name), '[^a-z0-9]+', '', 'g') LIKE $${idx + 1}
      OR regexp_replace(lower(regexp_replace(r.name, '\\m(restaurant|resto|rest|cafe|café|bistro|grill|place)\\M', '', 'gi')), '[^a-z0-9]+', '', 'g') LIKE $${idx + 1}
      OR r.name ILIKE $${idx + 2}
    )`);
    values.push(namePattern, compactPattern, cleanedPattern);
    idx += 3;
  }

  if (cuisineList.length > 0) {
  const aliasTerms = cuisineList.flatMap((cuisine) => CUISINE_SEARCH_ALIASES[cuisine] || [cuisine]);
  const aliasPatterns = [...new Set(aliasTerms.map((term) => `%${term}%`))];

  conditions.push(`(
    r.cuisine = ANY($${idx}::text[])
    OR COALESCE(r.name, '') ILIKE ANY($${idx + 1}::text[])
    OR COALESCE(r.description, '') ILIKE ANY($${idx + 1}::text[])
    OR COALESCE(r.cuisine, '') ILIKE ANY($${idx + 1}::text[])
  )`);

  values.push(cuisineList, aliasPatterns);
  idx += 2;
}

  if (minRating != null) {
    conditions.push(`COALESCE(r.rating, 0) >= $${idx}`);
    values.push(minRating);
    idx += 1;
  }

  if (maxRating != null) {
    conditions.push(`COALESCE(r.rating, 0) <= $${idx}`);
    values.push(maxRating);
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
          AND rs.status IN ('pending', 'accepted', 'confirmed')
      ) slot ON true
    `);
    joins.push(`
      LEFT JOIN reservation_slot_adjustments rsa
        ON rsa.restaurant_id = r.id
        AND rsa.reservation_date = $${idx}
        AND rsa.reservation_time = $${idx + 1}::time
        AND rsa.seating_preference = 'any'
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
    const availableExpression = `GREATEST(${capacityExpression} - COALESCE(slot.booked_seats, 0), 0)`;

    selectExtras.push(`${availableExpression}::int AS available_seats`);
    if (partySize != null && partySize > 0) {
      conditions.push(`${availableExpression} >= $${idx}`);
      values.push(partySize);
      idx += 1;
    } else {
      conditions.push(`${availableExpression} > 0`);
    }
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  let orderBy = "ORDER BY r.rating DESC NULLS LAST, review_count DESC, r.name ASC";
  if (sortBy === "distance") {
    orderBy = hasCoords
      ? "ORDER BY distance_km ASC NULLS LAST, r.rating DESC NULLS LAST, review_count DESC, r.name ASC"
      : "ORDER BY r.rating DESC NULLS LAST, review_count DESC, r.name ASC";
  } else if (sortBy === "rating_asc") {
    orderBy = "ORDER BY r.rating ASC NULLS LAST, review_count DESC, r.name ASC";
  } else if (sortBy === "reviews") {
    orderBy = "ORDER BY review_count DESC, r.rating DESC NULLS LAST, r.name ASC";
  } else if (sortBy === "popularity") {
    orderBy = "ORDER BY popularity_score DESC, review_count DESC, r.rating DESC NULLS LAST, r.name ASC";
  } else if (sortBy === "alphabetical") {
    orderBy = "ORDER BY r.name ASC, r.rating DESC NULLS LAST";
  }

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

const cleanRestaurantName = (name = "") => {
  return String(name || "")
    .trim()
    .replace(/\b(restaurant|resto|rest|cafe|café|bistro|grill|place)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const compactRestaurantName = (name = "") => cleanRestaurantName(name)
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "");

  const getApprovedRestaurantLookupCandidates = async () => {
  const result = await pool.query(
    `
      SELECT
        r.id,
        r.name,
        r.cuisine,
        r.rating,
        r.price_range,
        r.dietary_support,
        r.opening_time,
        r.closing_time,
        r.address,
        r.latitude,
        r.longitude,
        (
          SELECT COUNT(*)::int
          FROM reviews rv
          WHERE rv.restaurant_id = r.id
            AND NOT EXISTS (
              SELECT 1 FROM flagged_reviews fr
              WHERE fr.review_id = rv.id
                AND (
                  (
                    fr.status = 'pending'
                    AND COALESCE(fr.suggested_action, 'REQUIRES_REVIEW') = 'REQUIRES_REVIEW'
                  )
                  OR (
                    fr.status = 'resolved'
                    AND fr.moderator_action = 'REQUIRE_CHANGES'
                    AND COALESCE(fr.resolved_at, fr.updated_at, fr.created_at) >= COALESCE(rv.updated_at, rv.created_at)
                  )
                )
            )
        ) AS review_count,
        r.updated_at
      FROM restaurants r
      WHERE r.is_verified = true
        AND r.approval_status = 'approved'
      ORDER BY r.updated_at DESC, r.name ASC
    `
  );

  return result.rows;
};

const findRestaurantByName = async (name) => {
  const original = String(name || "").trim();
  const cleaned = cleanRestaurantName(original);
  const compact = compactRestaurantName(cleaned || original);

  if (!original && !cleaned) return null;

  const result = await pool.query(
    `
      WITH candidates AS (
        SELECT
          r.id,
          r.name,
          r.cuisine,
          r.rating,
          r.price_range,
          r.dietary_support,
          r.opening_time,
          r.closing_time,
          r.address,
          (
            SELECT COUNT(*)::int
            FROM reviews rv
            WHERE rv.restaurant_id = r.id
              AND NOT EXISTS (
                SELECT 1 FROM flagged_reviews fr
                WHERE fr.review_id = rv.id
                  AND (
                    (
                      fr.status = 'pending'
                      AND COALESCE(fr.suggested_action, 'REQUIRES_REVIEW') = 'REQUIRES_REVIEW'
                    )
                    OR (
                      fr.status = 'resolved'
                      AND fr.moderator_action = 'REQUIRE_CHANGES'
                      AND COALESCE(fr.resolved_at, fr.updated_at, fr.created_at) >= COALESCE(rv.updated_at, rv.created_at)
                    )
                  )
              )
          ) AS review_count,
          r.is_verified,
          r.updated_at,
          LOWER(r.name) AS lowered_name,
          LOWER(regexp_replace(r.name, '\\m(restaurant|resto|rest|cafe|café|bistro|grill|place)\\M', '', 'gi')) AS cleaned_name,
          regexp_replace(lower(regexp_replace(r.name, '\\m(restaurant|resto|rest|cafe|café|bistro|grill|place)\\M', '', 'gi')), '[^a-z0-9]+', '', 'g') AS compact_name
        FROM restaurants r
        WHERE r.is_verified = true
          AND r.approval_status = 'approved'
      )
      SELECT id, name, cuisine, rating, price_range, dietary_support, opening_time, closing_time, address, review_count, is_verified, updated_at
      FROM candidates
      WHERE lowered_name = LOWER($1)
         OR cleaned_name = LOWER($2)
         OR compact_name = $3
         OR lowered_name LIKE LOWER($4)
         OR cleaned_name LIKE LOWER($5)
         OR compact_name LIKE $6
         OR POSITION($3 IN compact_name) > 0
      ORDER BY CASE
        WHEN lowered_name = LOWER($1) THEN 1
        WHEN cleaned_name = LOWER($2) THEN 2
        WHEN compact_name = $3 THEN 3
        WHEN lowered_name LIKE LOWER($4) THEN 4
        WHEN cleaned_name LIKE LOWER($5) THEN 5
        WHEN compact_name LIKE $6 THEN 6
        WHEN POSITION($3 IN compact_name) > 0 THEN 7
        ELSE 99
      END,
      LENGTH(name) ASC,
      updated_at DESC
      LIMIT 1
    `,
    [
      original,
      cleaned || original,
      compact,
      `${original}%`,
      `${cleaned || original}%`,
      `${compact}%`,
    ]
  );

  return result.rows[0] || null;
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
  getApprovedRestaurantLookupCandidates,
  findRestaurantByName,
  requestRestaurantDeletion,
  cancelRestaurantDeletionRequest,
  getPendingDeletionRestaurants,
};
