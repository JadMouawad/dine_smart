// backend/src/routes/review.routes.js
// Routes for restaurant reviews (nested under /restaurants/:restaurantId/reviews)

const express = require("express");
const router = express.Router({ mergeParams: true });
const requireAuth = require("../middleware/requireAuth");
const {
  getReviews,
  createReview,
  updateReview,
  deleteReview,
} = require("../controllers/reviewController");

// GET /api/restaurants/:restaurantId/reviews - List reviews (public)
router.get("/", getReviews);

// POST /api/restaurants/:restaurantId/reviews - Create review (auth required)
router.post("/", requireAuth, createReview);

// PUT /api/restaurants/:restaurantId/reviews/:reviewId - Update review (auth required, owner only)
router.put("/:reviewId", requireAuth, updateReview);

// DELETE /api/restaurants/:restaurantId/reviews/:reviewId - Delete review (auth required, owner only)
router.delete("/:reviewId", requireAuth, deleteReview);

module.exports = router;
