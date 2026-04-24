// backend/src/models/reservation.model.js
// Database queries for reservation workflow.

async function getRestaurantById(db, restaurantId) {
  const query = `
    SELECT id, owner_id, name, opening_time, closing_time, is_verified, approval_status
    FROM restaurants
    WHERE id = $1;
  `;
  return db.query(query, [restaurantId]);
}

async function acquireTransactionLock(db, lockKey) {
  const query = `
    SELECT pg_advisory_xact_lock(hashtext($1));
  `;
  return db.query(query, [lockKey]);
}

async function getTableConfigByRestaurantId(db, restaurantId) {
  const query = `
    SELECT restaurant_id, total_capacity, table_2_person, table_4_person, table_6_person,
           indoor_capacity, outdoor_capacity
    FROM restaurant_table_configs
    WHERE restaurant_id = $1;
  `;
  return db.query(query, [restaurantId]);
}

async function getBookedSeatsForSlot(db, restaurantId, reservationDate, reservationTime, durationMinutes = 120) {
  const query = `
    SELECT COALESCE(SUM(party_size), 0) AS booked_seats
    FROM reservations
    WHERE restaurant_id = $1
      AND reservation_date = $2
      AND status IN ('pending', 'accepted', 'confirmed')
      AND reservation_time < ($3::time + ($4 * interval '1 minute'))
      AND (reservation_time + (duration_minutes * interval '1 minute')) > $3::time;
  `;
  return db.query(query, [restaurantId, reservationDate, reservationTime, durationMinutes]);
}

async function createReservation(db, data) {
  const {
    userId,
    restaurantId,
    reservationDate,
    reservationTime,
    partySize,
    seatingPreference,
    specialRequest,
    confirmationId,
    status,
    voucherId,
    discountPercentage,
    durationMinutes,
  } = data;

  const query = `
    INSERT INTO reservations (
      user_id,
      restaurant_id,
      reservation_date,
      reservation_time,
      party_size,
      seating_preference,
      special_request,
      status,
      confirmation_id,
      voucher_id,
      discount_percentage,
      duration_minutes
    )
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id, user_id, restaurant_id, reservation_date::text AS reservation_date, reservation_time::text AS reservation_time, party_size,
              seating_preference, special_request, status, confirmation_id, voucher_id, discount_percentage, duration_minutes, created_at, updated_at;
  `;

  return db.query(query, [
    userId,
    restaurantId,
    reservationDate,
    reservationTime,
    partySize,
    seatingPreference || null,
    specialRequest || null,
    status || "pending",
    confirmationId,
    voucherId || null,
    discountPercentage || null,
    durationMinutes || 120,
  ]);
}

async function getReservationById(db, reservationId) {
  const query = `
    SELECT id, user_id, restaurant_id, reservation_date::text AS reservation_date, reservation_time::text AS reservation_time, party_size,
           seating_preference, special_request, status, confirmation_id, duration_minutes, created_at, updated_at
    FROM reservations
    WHERE id = $1;
  `;
  return db.query(query, [reservationId]);
}

async function getUserReservations(db, userId) {
  const query = `
    SELECT r.id, r.user_id, r.restaurant_id, r.reservation_date::text AS reservation_date, r.reservation_time::text AS reservation_time, r.party_size,
           r.seating_preference, r.special_request, r.status, r.confirmation_id, r.duration_minutes, r.created_at, r.updated_at,
           rest.name AS restaurant_name, rest.address AS restaurant_address
    FROM reservations r
    JOIN restaurants rest ON rest.id = r.restaurant_id
    WHERE r.user_id = $1
    ORDER BY r.reservation_date DESC, r.reservation_time DESC, r.created_at DESC;
  `;
  return db.query(query, [userId]);
}

async function getMostRecentReservationByUser(db, userId) {
  const query = `
    SELECT id, user_id, restaurant_id, reservation_date::text AS reservation_date, reservation_time::text AS reservation_time,
           party_size, status, duration_minutes, created_at
    FROM reservations
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  return db.query(query, [userId]);
}

async function getActiveUserReservationsForDate(db, userId, reservationDate) {
  const query = `
    SELECT r.id, r.restaurant_id, r.reservation_time::text AS reservation_time, r.duration_minutes, r.status
    FROM reservations r
    WHERE r.user_id = $1
      AND r.reservation_date = $2
      AND r.status IN ('pending', 'accepted', 'confirmed')
    ORDER BY r.reservation_time ASC, r.created_at ASC;
  `;
  return db.query(query, [userId, reservationDate]);
}

async function cancelReservation(db, reservationId) {
  const query = `
    UPDATE reservations
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = $1
      AND status IN ('pending', 'accepted', 'confirmed')
    RETURNING id, user_id, restaurant_id, reservation_date::text AS reservation_date, reservation_time::text AS reservation_time, party_size,
              seating_preference, special_request, status, confirmation_id, duration_minutes, created_at, updated_at;
  `;
  return db.query(query, [reservationId]);
}

async function getOwnerReservations(db, ownerId) {
  const query = `
    SELECT r.id, r.user_id, r.restaurant_id, r.reservation_date::text AS reservation_date, r.reservation_time::text AS reservation_time,
           r.party_size, r.seating_preference, r.special_request, r.status, r.confirmation_id, r.duration_minutes, r.created_at, r.updated_at,
           rest.name AS restaurant_name, rest.address AS restaurant_address,
           u.full_name AS customer_name, u.email AS customer_email
    FROM reservations r
    JOIN restaurants rest ON rest.id = r.restaurant_id
    JOIN users u ON u.id = r.user_id
    WHERE rest.owner_id = $1
    ORDER BY r.reservation_date DESC, r.reservation_time DESC, r.created_at DESC;
  `;
  return db.query(query, [ownerId]);
}

async function getOwnerReservationById(db, { reservationId, ownerId }) {
  const query = `
    SELECT r.id, r.user_id, r.restaurant_id, r.reservation_date::text AS reservation_date, r.reservation_time::text AS reservation_time,
           r.party_size, r.seating_preference, r.special_request, r.status, r.confirmation_id, r.duration_minutes, r.created_at, r.updated_at,
           rest.name AS restaurant_name, rest.address AS restaurant_address,
           u.full_name AS customer_name, u.email AS customer_email
    FROM reservations r
    JOIN restaurants rest ON rest.id = r.restaurant_id
    JOIN users u ON u.id = r.user_id
    WHERE r.id = $1
      AND rest.owner_id = $2
    LIMIT 1;
  `;
  return db.query(query, [reservationId, ownerId]);
}

async function updateOwnerReservationStatus(db, { reservationId, ownerId, status }) {
  const query = `
    WITH updated AS (
      UPDATE reservations r
      SET status = $3, updated_at = NOW()
      FROM restaurants rest
      WHERE r.id = $1
        AND r.restaurant_id = rest.id
        AND rest.owner_id = $2
      RETURNING r.id, r.user_id, r.restaurant_id, r.reservation_date::text AS reservation_date, r.reservation_time::text AS reservation_time,
                r.party_size, r.seating_preference, r.special_request, r.status, r.confirmation_id, r.duration_minutes, r.created_at, r.updated_at
    )
    SELECT updated.*,
           rest.name AS restaurant_name, rest.address AS restaurant_address,
           u.full_name AS customer_name, u.email AS customer_email
    FROM updated
    JOIN restaurants rest ON rest.id = updated.restaurant_id
    JOIN users u ON u.id = updated.user_id;
  `;
  return db.query(query, [reservationId, ownerId, status]);
}

async function deleteOwnerReservationById(db, { reservationId, ownerId }) {
  const query = `
    DELETE FROM reservations r
    USING restaurants rest
    WHERE r.id = $1
      AND r.restaurant_id = rest.id
      AND rest.owner_id = $2
    RETURNING r.id, r.user_id, r.restaurant_id, r.reservation_date::text AS reservation_date, r.reservation_time::text AS reservation_time,
              r.party_size, r.seating_preference, r.special_request, r.status, r.confirmation_id, r.duration_minutes, r.created_at, r.updated_at;
  `;
  return db.query(query, [reservationId, ownerId]);
}

async function getReservationsForSlot(db, restaurantId, reservationDate, reservationTime, durationMinutes = 120) {
  const query = `
    SELECT party_size, seating_preference, duration_minutes
    FROM reservations
    WHERE restaurant_id = $1
      AND reservation_date = $2
      AND status IN ('pending', 'accepted', 'confirmed')
      AND reservation_time < ($3::time + ($4 * interval '1 minute'))
      AND (reservation_time + (duration_minutes * interval '1 minute')) > $3::time;
  `;
  return db.query(query, [restaurantId, reservationDate, reservationTime, durationMinutes]);
}

async function getSlotAdjustments(db, restaurantId, reservationDate, reservationTime) {
  const query = `
    SELECT seating_preference, adjustment
    FROM reservation_slot_adjustments
    WHERE restaurant_id = $1
      AND reservation_date = $2
      AND reservation_time = $3;
  `;
  return db.query(query, [restaurantId, reservationDate, reservationTime]);
}

async function getSlotAdjustment(db, restaurantId, reservationDate, reservationTime, seatingPreference) {
  const query = `
    SELECT seating_preference, adjustment
    FROM reservation_slot_adjustments
    WHERE restaurant_id = $1
      AND reservation_date = $2
      AND reservation_time = $3
      AND seating_preference = $4
    LIMIT 1;
  `;
  return db.query(query, [restaurantId, reservationDate, reservationTime, seatingPreference]);
}

async function upsertSlotAdjustment(db, data) {
  const {
    restaurantId,
    reservationDate,
    reservationTime,
    seatingPreference,
    adjustment,
  } = data;

  const query = `
    INSERT INTO reservation_slot_adjustments (
      restaurant_id,
      reservation_date,
      reservation_time,
      seating_preference,
      adjustment
    )
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (restaurant_id, reservation_date, reservation_time, seating_preference)
    DO UPDATE SET adjustment = EXCLUDED.adjustment, updated_at = NOW()
    RETURNING id, restaurant_id, reservation_date::text AS reservation_date, reservation_time::text AS reservation_time,
              seating_preference, adjustment, created_at, updated_at;
  `;

  return db.query(query, [
    restaurantId,
    reservationDate,
    reservationTime,
    seatingPreference,
    adjustment,
  ]);
}

async function upsertWaitlistEntry(db, data) {
  const {
    userId,
    restaurantId,
    reservationDate,
    reservationTime,
    partySize,
  } = data;

  const query = `
    INSERT INTO reservation_waitlist (
      user_id,
      restaurant_id,
      reservation_date,
      reservation_time,
      party_size,
      status
    )
    VALUES ($1, $2, $3, $4, $5, 'pending')
    ON CONFLICT (user_id, restaurant_id, reservation_date, reservation_time)
    DO UPDATE SET party_size = EXCLUDED.party_size, status = 'pending', notified_at = NULL, updated_at = NOW()
    RETURNING id, user_id, restaurant_id, reservation_date::text AS reservation_date, reservation_time::text AS reservation_time,
              party_size, status, notified_at, created_at, updated_at;
  `;

  return db.query(query, [
    userId,
    restaurantId,
    reservationDate,
    reservationTime,
    partySize,
  ]);
}

async function getWaitlistForSlot(db, data) {
  const { restaurantId, reservationDate, reservationTime } = data;
  const query = `
    SELECT wl.id, wl.user_id, wl.restaurant_id, wl.reservation_date::text AS reservation_date,
           wl.reservation_time::text AS reservation_time, wl.party_size, wl.status, wl.created_at,
           u.full_name, u.email
    FROM reservation_waitlist wl
    JOIN users u ON u.id = wl.user_id
    WHERE wl.restaurant_id = $1
      AND wl.reservation_date = $2
      AND wl.reservation_time = $3
      AND wl.status = 'pending'
    ORDER BY wl.created_at ASC;
  `;

  return db.query(query, [restaurantId, reservationDate, reservationTime]);
}

async function markWaitlistNotified(db, waitlistId) {
  const query = `
    UPDATE reservation_waitlist
    SET status = 'notified', notified_at = NOW(), updated_at = NOW()
    WHERE id = $1
    RETURNING id, user_id, restaurant_id, reservation_date::text AS reservation_date,
              reservation_time::text AS reservation_time, party_size, status, notified_at, created_at, updated_at;
  `;
  return db.query(query, [waitlistId]);
}

async function cancelWaitlistEntry(db, data) {
  const { userId, restaurantId, reservationDate, reservationTime } = data;
  const query = `
    UPDATE reservation_waitlist
    SET status = 'cancelled', updated_at = NOW()
    WHERE user_id = $1
      AND restaurant_id = $2
      AND reservation_date = $3
      AND reservation_time = $4
    RETURNING id, user_id, restaurant_id, reservation_date::text AS reservation_date,
              reservation_time::text AS reservation_time, party_size, status, notified_at, created_at, updated_at;
  `;
  return db.query(query, [userId, restaurantId, reservationDate, reservationTime]);
}

async function cancelWaitlistEntryByUserAndSlot(db, data) {
  return cancelWaitlistEntry(db, data);
}

async function getDisabledSlotsForDate(db, restaurantId, reservationDate) {
  const query = `
    SELECT id, restaurant_id, reservation_date::text AS reservation_date, reservation_time::text AS reservation_time,
           seating_preference, reason, created_at, updated_at
    FROM reservation_disabled_slots
    WHERE restaurant_id = $1
      AND reservation_date = $2
    ORDER BY reservation_time ASC, seating_preference ASC, created_at ASC;
  `;
  return db.query(query, [restaurantId, reservationDate]);
}

async function getDisabledSlot(db, restaurantId, reservationDate, reservationTime, seatingPreference) {
  const query = `
    SELECT id, restaurant_id, reservation_date::text AS reservation_date, reservation_time::text AS reservation_time,
           seating_preference, reason, created_at, updated_at
    FROM reservation_disabled_slots
    WHERE restaurant_id = $1
      AND reservation_date = $2
      AND reservation_time = $3
      AND seating_preference = $4
    LIMIT 1;
  `;
  return db.query(query, [restaurantId, reservationDate, reservationTime, seatingPreference]);
}

async function upsertDisabledSlot(db, data) {
  const {
    restaurantId,
    reservationDate,
    reservationTime,
    seatingPreference,
    reason,
  } = data;

  const query = `
    INSERT INTO reservation_disabled_slots (
      restaurant_id,
      reservation_date,
      reservation_time,
      seating_preference,
      reason
    )
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (restaurant_id, reservation_date, reservation_time, seating_preference)
    DO UPDATE SET reason = EXCLUDED.reason, updated_at = NOW()
    RETURNING id, restaurant_id, reservation_date::text AS reservation_date, reservation_time::text AS reservation_time,
              seating_preference, reason, created_at, updated_at;
  `;

  return db.query(query, [
    restaurantId,
    reservationDate,
    reservationTime,
    seatingPreference,
    reason,
  ]);
}

async function deleteDisabledSlot(db, restaurantId, reservationDate, reservationTime, seatingPreference) {
  const query = `
    DELETE FROM reservation_disabled_slots
    WHERE restaurant_id = $1
      AND reservation_date = $2
      AND reservation_time = $3
      AND seating_preference = $4
    RETURNING id, restaurant_id, reservation_date::text AS reservation_date, reservation_time::text AS reservation_time,
              seating_preference, reason, created_at, updated_at;
  `;
  return db.query(query, [restaurantId, reservationDate, reservationTime, seatingPreference]);
}

module.exports = {
  acquireTransactionLock,
  getRestaurantById,
  getTableConfigByRestaurantId,
  getBookedSeatsForSlot,
  createReservation,
  getReservationById,
  getUserReservations,
  getMostRecentReservationByUser,
  getActiveUserReservationsForDate,
  cancelReservation,
  getOwnerReservations,
  getOwnerReservationById,
  updateOwnerReservationStatus,
  deleteOwnerReservationById,
  getReservationsForSlot,
  getSlotAdjustments,
  getSlotAdjustment,
  upsertSlotAdjustment,
  upsertWaitlistEntry,
  getWaitlistForSlot,
  markWaitlistNotified,
  cancelWaitlistEntry,
  cancelWaitlistEntryByUserAndSlot,
  getDisabledSlotsForDate,
  getDisabledSlot,
  upsertDisabledSlot,
  deleteDisabledSlot,
};

