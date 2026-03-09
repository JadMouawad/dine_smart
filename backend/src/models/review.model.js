// backend/src/models/review.model.js
// Database queries for restaurant reviews

async function createReview(db, { restaurantId, userId, rating, comment }) {
  const query = `
    INSERT INTO reviews (restaurant_id, user_id, rating, comment)
    VALUES ($1, $2, $3, $4)
    RETURNING id, restaurant_id, user_id, rating, comment, owner_response, owner_response_date, created_at, updated_at;
  `;
  return db.query(query, [restaurantId, userId, rating, comment || null]);
}

async function getReviewsByRestaurant(db, restaurantId) {
  const query = `
    SELECT r.id, r.restaurant_id, r.user_id, r.rating, r.comment,
           r.owner_response, r.owner_response_date,
           r.created_at, r.updated_at,
           u.full_name as user_name,
           u.profile_picture_url,
           u.profile_picture_url as "profilePictureUrl",
           u.full_name as "authorName",
           r.created_at as "createdAt"
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    WHERE r.restaurant_id = $1
    ORDER BY r.created_at DESC;
  `;
  return db.query(query, [restaurantId]);
}

async function getUserReviewForRestaurant(db, userId, restaurantId) {
  const query = `
    SELECT id, restaurant_id, user_id, rating, comment, owner_response, owner_response_date, created_at, updated_at
    FROM reviews
    WHERE user_id = $1 AND restaurant_id = $2;
  `;
  return db.query(query, [userId, restaurantId]);
}

async function getReviewById(db, reviewId) {
  const query = `
    SELECT id, restaurant_id, user_id, rating, comment, owner_response, owner_response_date, created_at, updated_at
    FROM reviews
    WHERE id = $1;
  `;
  return db.query(query, [reviewId]);
}

async function updateReview(db, reviewId, userId, { rating, comment }) {
  const query = `
    UPDATE reviews
    SET rating = $1, comment = $2, updated_at = NOW()
    WHERE id = $3 AND user_id = $4
    RETURNING id, restaurant_id, user_id, rating, comment, owner_response, owner_response_date, created_at, updated_at;
  `;
  return db.query(query, [rating, comment ?? null, reviewId, userId]);
}

async function deleteReview(db, reviewId, userId) {
  const query = `
    DELETE FROM reviews
    WHERE id = $1 AND user_id = $2
    RETURNING id;
  `;
  return db.query(query, [reviewId, userId]);
}

async function getAverageRating(db, restaurantId) {
  const query = `
    SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0) as avg_rating, COUNT(*) as count
    FROM reviews
    WHERE restaurant_id = $1;
  `;
  return db.query(query, [restaurantId]);
}

async function hasUserFlaggedReview(db, reviewId, userId) {
  const query = `
    SELECT id
    FROM flagged_reviews
    WHERE review_id = $1
      AND user_id = $2
    LIMIT 1;
  `;
  return db.query(query, [reviewId, userId]);
}

async function createFlaggedReview(db, { reviewId, userId, reason }) {
  const query = `
    INSERT INTO flagged_reviews (review_id, user_id, reason, status)
    VALUES ($1, $2, $3, 'pending')
    RETURNING id, review_id, user_id, reason, status, created_at;
  `;
  return db.query(query, [reviewId, userId, reason]);
}

async function getReviewWithRestaurantOwner(db, reviewId) {
  const query = `
    SELECT rv.id, rv.restaurant_id, rv.user_id, rest.owner_id
    FROM reviews rv
    JOIN restaurants rest ON rest.id = rv.restaurant_id
    WHERE rv.id = $1
    LIMIT 1;
  `;
  return db.query(query, [reviewId]);
}

async function updateOwnerResponse(db, { reviewId, ownerResponse }) {
  const query = `
    UPDATE reviews
    SET owner_response = $1,
        owner_response_date = NOW(),
        updated_at = NOW()
    WHERE id = $2
    RETURNING id, restaurant_id, user_id, rating, comment, owner_response, owner_response_date, created_at, updated_at;
  `;
  return db.query(query, [ownerResponse, reviewId]);
}

module.exports = {
  createReview,
  getReviewsByRestaurant,
  getUserReviewForRestaurant,
  getReviewById,
  updateReview,
  deleteReview,
  getAverageRating,
  hasUserFlaggedReview,
  createFlaggedReview,
  getReviewWithRestaurantOwner,
  updateOwnerResponse,
};
