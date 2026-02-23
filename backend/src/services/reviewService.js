// backend/src/services/reviewService.js
// Business logic for restaurant reviews

const db = require("../config/db");
const ReviewModel = require("../models/review.model");
const RestaurantModel = require("../models/restaurant.model");
const restaurantRepository = require("../repositories/restaurantRepository");

const RECOMMENT_MAX_LENGTH = 500;

const updateRestaurantAverageRating = async (restaurantId) => {
  const avgResult = await ReviewModel.getAverageRating(db, restaurantId);
  const avg = parseFloat(avgResult.rows[0]?.avg_rating) || 0;
  await restaurantRepository.updateRestaurantRating(restaurantId, avg);
};

const createReview = async (restaurantId, userId, { rating, comment }) => {
  const restaurantResult = await RestaurantModel.getRestaurantById(db, restaurantId);
  if (!restaurantResult.rows[0]) {
    return { success: false, error: "Restaurant not found", status: 404 };
  }

  const existing = await ReviewModel.getUserReviewForRestaurant(db, userId, restaurantId);
  if (existing.rows.length > 0) {
    return { success: false, error: "You have already reviewed this restaurant", status: 409 };
  }

  const commentStr = comment != null ? String(comment).trim() : "";
  if (commentStr.length > RECOMMENT_MAX_LENGTH) {
    return { success: false, error: "Review comment must be at most 500 characters", status: 400 };
  }

  const result = await ReviewModel.createReview(db, {
    restaurantId,
    userId,
    rating,
    comment: commentStr || null,
  });
  await updateRestaurantAverageRating(restaurantId);
  return { success: true, review: result.rows[0] };
};

const getReviewsByRestaurant = async (restaurantId) => {
  const restaurantResult = await RestaurantModel.getRestaurantById(db, restaurantId);
  if (!restaurantResult.rows[0]) {
    return { success: false, error: "Restaurant not found", status: 404 };
  }

  const result = await ReviewModel.getReviewsByRestaurant(db, restaurantId);
  return { success: true, reviews: result.rows };
};

const updateReview = async (reviewId, userId, { rating, comment }) => {
  const reviewResult = await ReviewModel.getReviewById(db, reviewId);
  if (!reviewResult.rows[0]) {
    return { success: false, error: "Review not found", status: 404 };
  }
  if (reviewResult.rows[0].user_id !== parseInt(userId, 10)) {
    return { success: false, error: "You can only edit your own review", status: 403 };
  }

  const commentStr = comment != null ? String(comment).trim() : "";
  if (commentStr.length > RECOMMENT_MAX_LENGTH) {
    return { success: false, error: "Review comment must be at most 500 characters", status: 400 };
  }

  const result = await ReviewModel.updateReview(db, reviewId, userId, { rating, comment: commentStr || null });
  const restaurantId = reviewResult.rows[0].restaurant_id;
  await updateRestaurantAverageRating(restaurantId);
  return { success: true, review: result.rows[0] };
};

const deleteReview = async (reviewId, userId) => {
  const reviewResult = await ReviewModel.getReviewById(db, reviewId);
  if (!reviewResult.rows[0]) {
    return { success: false, error: "Review not found", status: 404 };
  }
  if (reviewResult.rows[0].user_id !== parseInt(userId, 10)) {
    return { success: false, error: "You can only delete your own review", status: 403 };
  }

  const restaurantId = reviewResult.rows[0].restaurant_id;
  await ReviewModel.deleteReview(db, reviewId, userId);
  await updateRestaurantAverageRating(restaurantId);
  return { success: true };
};

const getAverageRating = async (restaurantId) => {
  const result = await ReviewModel.getAverageRating(db, restaurantId);
  return result.rows[0];
};

module.exports = {
  createReview,
  getReviewsByRestaurant,
  updateReview,
  deleteReview,
  getAverageRating,
};
