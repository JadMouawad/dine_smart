// backend/src/services/reviewService.js
// Business logic for restaurant reviews

const db = require("../config/db");
const ReviewModel = require("../models/review.model");
const RestaurantModel = require("../models/restaurant.model");
const restaurantRepository = require("../repositories/restaurantRepository");

const RECOMMENT_MAX_LENGTH = 500;
const DEFAULT_BAD_WORDS = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "dick",
  "piss",
  "cunt",
  "slut",
  "whore",
];

const badWords = String(process.env.BAD_WORDS || "")
  .split(",")
  .map((word) => word.trim())
  .filter(Boolean);

const PROFANITY_LIST = badWords.length ? badWords : DEFAULT_BAD_WORDS;

const containsProfanity = (text) => {
  if (!text) return false;
  const normalized = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (!normalized) return false;
  const tokens = new Set(normalized.split(/\s+/).filter(Boolean));
  return PROFANITY_LIST.some((word) => tokens.has(word.toLowerCase()));
};

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

  const review = result.rows[0];
  if (commentStr && containsProfanity(commentStr)) {
    try {
      await ReviewModel.createFlaggedReview(db, {
        reviewId: review.id,
        userId,
        reason: "Auto-flagged: profanity detected",
      });
    } catch (error) {
      if (error.code !== "23505") {
        throw error;
      }
    }
    await updateRestaurantAverageRating(restaurantId);
    return {
      success: true,
      status: 202,
      flagged: true,
      review,
      message: "Your review was flagged for moderation and will not be visible until approved.",
    };
  }

  await updateRestaurantAverageRating(restaurantId);
  return { success: true, review };
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
  if (commentStr && containsProfanity(commentStr)) {
    try {
      await ReviewModel.createFlaggedReview(db, {
        reviewId,
        userId,
        reason: "Auto-flagged: profanity detected",
      });
    } catch (error) {
      if (error.code !== "23505") {
        throw error;
      }
    }
  }
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

const flagReview = async ({ reviewId, userId, reason }) => {
  const parsedReviewId = parseInt(reviewId, 10);
  if (Number.isNaN(parsedReviewId)) {
    return { success: false, status: 400, error: "Invalid review ID" };
  }

  const cleanReason = String(reason || "").trim();
  if (!cleanReason) {
    return { success: false, status: 400, error: "reason is required" };
  }
  if (cleanReason.length > 500) {
    return { success: false, status: 400, error: "reason must be at most 500 characters" };
  }

  const reviewResult = await ReviewModel.getReviewById(db, parsedReviewId);
  const review = reviewResult.rows[0];
  if (!review) {
    return { success: false, status: 404, error: "Review not found" };
  }
  if (review.user_id === parseInt(userId, 10)) {
    return { success: false, status: 409, error: "You cannot flag your own review" };
  }

  const existingFlag = await ReviewModel.hasUserFlaggedReview(db, parsedReviewId, userId);
  if (existingFlag.rows.length > 0) {
    return { success: false, status: 409, error: "You have already flagged this review" };
  }

  try {
    const created = await ReviewModel.createFlaggedReview(db, {
      reviewId: parsedReviewId,
      userId,
      reason: cleanReason,
    });
    return { success: true, status: 201, data: created.rows[0] };
  } catch (error) {
    if (error.code === "23505") {
      return { success: false, status: 409, error: "You have already flagged this review" };
    }
    throw error;
  }
};

const respondToReviewAsOwner = async ({ reviewId, ownerId, ownerResponse }) => {
  const parsedReviewId = parseInt(reviewId, 10);
  if (Number.isNaN(parsedReviewId)) {
    return { success: false, status: 400, error: "Invalid review ID" };
  }

  const responseText = String(ownerResponse || "").trim();
  if (!responseText) {
    return { success: false, status: 400, error: "owner_response is required" };
  }
  if (responseText.length > 1000) {
    return { success: false, status: 400, error: "owner_response must be at most 1000 characters" };
  }

  const reviewWithOwner = await ReviewModel.getReviewWithRestaurantOwner(db, parsedReviewId);
  const review = reviewWithOwner.rows[0];
  if (!review) {
    return { success: false, status: 404, error: "Review not found" };
  }
  if (parseInt(review.owner_id, 10) !== parseInt(ownerId, 10)) {
    return { success: false, status: 403, error: "You can only respond to reviews for your own restaurant" };
  }

  const updated = await ReviewModel.updateOwnerResponse(db, {
    reviewId: parsedReviewId,
    ownerResponse: responseText,
  });
  return { success: true, status: 200, data: updated.rows[0] };
};

module.exports = {
  createReview,
  getReviewsByRestaurant,
  updateReview,
  deleteReview,
  getAverageRating,
  flagReview,
  respondToReviewAsOwner,
};
