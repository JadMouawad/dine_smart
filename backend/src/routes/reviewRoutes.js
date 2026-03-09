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

router.get("/", getReviews);
router.post("/", requireAuth, createReview);
router.put("/:reviewId", requireAuth, updateReview);
router.delete("/:reviewId", requireAuth, deleteReview);

module.exports = router;
