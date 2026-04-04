"use strict";

/**
 * chatActions.js
 * Tool implementations for the Diney AI agent.
 * Each function maps 1:1 to a GPT-4o tool definition.
 */

const crypto = require("crypto");
const pool = require("../config/db");
const restaurantRepository = require("../repositories/restaurantRepository");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const pad2 = (n) => String(n).padStart(2, "0");

const normalizeTimeStr = (value) => {
  const m = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  return `${pad2(m[1])}:${m[2]}:00`;
};

const generateConfirmationId = async () => {
  for (let i = 0; i < 10; i++) {
    const id = crypto.randomBytes(4).toString("hex").toUpperCase();
    const { rows } = await pool.query(
      "SELECT id FROM reservations WHERE confirmation_id = $1",
      [id]
    );
    if (!rows.length) return id;
  }
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
};

// ─── Tool: search_restaurants ─────────────────────────────────────────────────

const searchRestaurantsForChat = async (args, userLocation = null) => {
  const results = await restaurantRepository.searchRestaurants(
    args.query || "",
    args.cuisines || [],
    {
      minRating: args.min_rating || null,
      priceRanges: args.price_ranges || [],
      verifiedOnly: true,
      dietarySupport: args.dietary_support || [],
      openNow: args.open_now || false,
      sortBy: args.sort_by || "rating",
      latitude: userLocation?.latitude ?? null,
      longitude: userLocation?.longitude ?? null,
      distanceRadius: args.distance_radius ?? null,
    }
  );
  return results.slice(0, 5);
};

// ─── Tool: get_restaurant_details ─────────────────────────────────────────────

const findRestaurantByName = async (name) => {
  if (!name) return null;

  const cleanedName = name
    .replace(/\b(restaurant|resto|rest|cafe|café|place|bistro|grill)\b/gi, "")
    .trim();

  const results = await restaurantRepository.searchRestaurants(
    cleanedName || name,
    [],
    { verifiedOnly: true, sortBy: "rating" }
  );

  if (!results.length) return null;

  const lower = name.toLowerCase();
  const cleanedLower = cleanedName.toLowerCase();

  return (
    results.find((r) => r.name.toLowerCase() === lower) ||
    results.find((r) => r.name.toLowerCase().includes(cleanedLower)) ||
    results.find((r) => cleanedLower.includes(r.name.toLowerCase().split(" ")[0])) ||
    results[0]
  );
};

// ─── Tool: check_availability ─────────────────────────────────────────────────

const checkSlotAvailability = async (restaurantId, date, time, partySize = 1, seatingPreference = "any") => {
  const normalizedTime = normalizeTimeStr(time);
  if (!normalizedTime) {
    return { error: "Invalid time format. Please use HH:MM (e.g. 19:30)." };
  }

  // Get table config / capacity
  const { rows: configs } = await pool.query(
    "SELECT * FROM restaurant_table_configs WHERE restaurant_id = $1",
    [restaurantId]
  );
  const config = configs[0];

  if (!config) {
    return { error: "This restaurant has not configured its seating capacity yet." };
  }

  const t2 = parseInt(config.table_2_person, 10) || 0;
  const t4 = parseInt(config.table_4_person, 10) || 0;
  const t6 = parseInt(config.table_6_person, 10) || 0;
  const tableBased = t2 * 2 + t4 * 4 + t6 * 6;
  const totalCapacity = tableBased > 0 ? tableBased : parseInt(config.total_capacity, 10) || 0;
  const indoorCapacity = parseInt(config.indoor_capacity, 10) || 0;
  const outdoorCapacity = parseInt(config.outdoor_capacity, 10) || 0;

  if (!totalCapacity) {
    return { error: "Restaurant capacity is not set up yet." };
  }

  // Count booked seats for this slot
  const { rows: bookedRows } = await pool.query(
    `SELECT COALESCE(SUM(party_size), 0)::int AS booked_seats
     FROM reservations
     WHERE restaurant_id = $1
       AND reservation_date = $2
       AND reservation_time = $3
       AND status IN ('pending', 'accepted', 'confirmed')`,
    [restaurantId, date, normalizedTime]
  );
  const bookedSeats = bookedRows[0]?.booked_seats || 0;

  // Apply any slot adjustment
  const { rows: adjRows } = await pool.query(
    `SELECT adjustment FROM reservation_slot_adjustments
     WHERE restaurant_id = $1
       AND reservation_date = $2
       AND reservation_time = $3
       AND seating_preference = 'any'
     LIMIT 1`,
    [restaurantId, date, normalizedTime]
  );
  const adjustment = parseInt(adjRows[0]?.adjustment, 10) || 0;

  const adjustedTotal = Math.max(totalCapacity + adjustment, 0);
  const availableSeats = Math.max(adjustedTotal - bookedSeats, 0);
  const canAccommodate = availableSeats >= partySize;

  // Preference-specific availability
  let preferenceAvailable = null;
  if (seatingPreference === "indoor" && indoorCapacity > 0) {
    preferenceAvailable = Math.max(indoorCapacity - bookedSeats, 0);
  } else if (seatingPreference === "outdoor" && outdoorCapacity > 0) {
    preferenceAvailable = Math.max(outdoorCapacity - bookedSeats, 0);
  }

  return {
    total_capacity: adjustedTotal,
    booked_seats: bookedSeats,
    available_seats: availableSeats,
    can_accommodate: canAccommodate,
    is_fully_booked: availableSeats === 0,
    preference_available: preferenceAvailable,
    indoor_capacity: indoorCapacity || null,
    outdoor_capacity: outdoorCapacity || null,
  };
};

// ─── Tool: make_reservation ───────────────────────────────────────────────────

const createReservationForUser = async (
  userId,
  restaurantId,
  { date, time, partySize, seatingPreference = null, specialRequest = null }
) => {
  const normalizedTime = normalizeTimeStr(time);
  if (!normalizedTime) {
    return { success: false, error: "Invalid time format. Please use HH:MM (e.g. 19:30)." };
  }

  // Check availability before booking
  const availability = await checkSlotAvailability(
    restaurantId,
    date,
    normalizedTime,
    partySize
  );

  if (availability.error) {
    return { success: false, error: availability.error };
  }

  if (!availability.can_accommodate) {
    return {
      success: false,
      error: `Not enough seats available. Only ${availability.available_seats} seats free for this slot — cannot accommodate a party of ${partySize}.`,
      available_seats: availability.available_seats,
    };
  }

  const confirmationId = await generateConfirmationId();

  const { rows } = await pool.query(
    `INSERT INTO reservations
       (user_id, restaurant_id, reservation_date, reservation_time,
        party_size, seating_preference, special_request, status, confirmation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
     RETURNING id, reservation_date, reservation_time, party_size,
               seating_preference, special_request, status, confirmation_id`,
    [
      userId,
      restaurantId,
      date,
      normalizedTime,
      partySize,
      seatingPreference || null,
      specialRequest || null,
      confirmationId,
    ]
  );

  return {
    success: true,
    confirmation_id: confirmationId,
    reservation: rows[0],
  };
};

// ─── Tool: search_menu_items ──────────────────────────────────────────────────

/**
 * Cross-restaurant JSONB menu search.
 * Finds specific dishes/items across all restaurant menus.
 *
 * menu_sections format:
 *   [{ sectionId, sectionName, items: [{ id, name, price, currency, description, imageUrl }] }]
 */
const searchMenuItems = async (query, { minRating = null, priceRanges = [], limit = 10 } = {}) => {
  if (!query || !query.trim()) return [];

  const pattern = `%${query.trim()}%`;
  const params = [pattern, pattern, pattern];
  let idx = 4;

  const conditions = [
    "r.is_verified = true",
    "r.approval_status = 'approved'",
    "r.menu_sections IS NOT NULL",
    "jsonb_typeof(r.menu_sections) = 'array'",
    `(
      item->>'name' ILIKE $1
      OR item->>'description' ILIKE $2
      OR sec->>'sectionName' ILIKE $3
    )`,
  ];

  if (minRating != null) {
    conditions.push(`COALESCE(r.rating, 0) >= $${idx}`);
    params.push(minRating);
    idx++;
  }

  if (priceRanges && priceRanges.length > 0) {
    conditions.push(`r.price_range = ANY($${idx}::text[])`);
    params.push(priceRanges);
    idx++;
  }

  const sql = `
    SELECT
      r.id             AS restaurant_id,
      r.name           AS restaurant_name,
      r.cuisine,
      r.rating,
      r.price_range,
      r.address,
      r.opening_time,
      r.closing_time,
      sec->>'sectionName'    AS section_name,
      item->>'name'          AS item_name,
      item->>'price'         AS item_price,
      item->>'currency'      AS item_currency,
      item->>'description'   AS item_description
    FROM restaurants r,
         jsonb_array_elements(r.menu_sections) AS sec,
         jsonb_array_elements(sec->'items')    AS item
    WHERE ${conditions.join(" AND ")}
    ORDER BY COALESCE(r.rating, 0) DESC NULLS LAST
    LIMIT $${idx}
  `;
  params.push(limit);

  const { rows } = await pool.query(sql, params);
  return rows;
};

// ─── Tool: get_platform_stats ─────────────────────────────────────────────────

const getPlatformStats = async () => {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*)::int                                                        AS total_restaurants,
      COUNT(*) FILTER (WHERE is_verified AND approval_status = 'approved')::int AS verified_restaurants,
      COUNT(DISTINCT cuisine) FILTER (WHERE cuisine IS NOT NULL)::int     AS cuisine_count,
      ROUND(AVG(rating) FILTER (WHERE rating IS NOT NULL), 2)             AS average_rating
    FROM restaurants
  `);
  return rows[0];
};

module.exports = {
  findRestaurantByName,
  searchRestaurantsForChat,
  checkSlotAvailability,
  createReservationForUser,
  searchMenuItems,
  getPlatformStats,
};
