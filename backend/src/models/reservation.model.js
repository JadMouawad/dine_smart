// backend/src/models/reservation.model.js
// Database queries for reservation workflow.

async function getRestaurantById(db, restaurantId) {
  const query = `
    SELECT id, name, opening_time, closing_time, is_verified, approval_status
    FROM restaurants
    WHERE id = $1;
  `;
  return db.query(query, [restaurantId]);
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

async function getBookedSeatsForSlot(db, restaurantId, reservationDate, reservationTime) {
  const query = `
    SELECT COALESCE(SUM(party_size), 0) AS booked_seats
    FROM reservations
    WHERE restaurant_id = $1
      AND reservation_date = $2
      AND reservation_time = $3
      AND status = 'confirmed';
  `;
  return db.query(query, [restaurantId, reservationDate, reservationTime]);
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
      confirmation_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, user_id, restaurant_id, reservation_date, reservation_time, party_size,
              seating_preference, special_request, status, confirmation_id, created_at, updated_at;
  `;

  return db.query(query, [
    userId,
    restaurantId,
    reservationDate,
    reservationTime,
    partySize,
    seatingPreference || null,
    specialRequest || null,
    confirmationId,
  ]);
}

async function getReservationById(db, reservationId) {
  const query = `
    SELECT id, user_id, restaurant_id, reservation_date, reservation_time, party_size,
           seating_preference, special_request, status, confirmation_id, created_at, updated_at
    FROM reservations
    WHERE id = $1;
  `;
  return db.query(query, [reservationId]);
}

async function getUserReservations(db, userId) {
  const query = `
    SELECT r.id, r.user_id, r.restaurant_id, r.reservation_date, r.reservation_time, r.party_size,
           r.seating_preference, r.special_request, r.status, r.confirmation_id, r.created_at, r.updated_at,
           rest.name AS restaurant_name, rest.address AS restaurant_address
    FROM reservations r
    JOIN restaurants rest ON rest.id = r.restaurant_id
    WHERE r.user_id = $1
    ORDER BY r.reservation_date DESC, r.reservation_time DESC, r.created_at DESC;
  `;
  return db.query(query, [userId]);
}

async function cancelReservation(db, reservationId) {
  const query = `
    UPDATE reservations
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = $1
      AND status = 'confirmed'
    RETURNING id, user_id, restaurant_id, reservation_date, reservation_time, party_size,
              seating_preference, special_request, status, confirmation_id, created_at, updated_at;
  `;
  return db.query(query, [reservationId]);
}

module.exports = {
  getRestaurantById,
  getTableConfigByRestaurantId,
  getBookedSeatsForSlot,
  createReservation,
  getReservationById,
  getUserReservations,
  cancelReservation,
};

