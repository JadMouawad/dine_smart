// backend/src/controllers/reviewController.js
// Handles HTTP requests for restaurant reviews

const reviewService = require("../services/reviewService");

// GET /restaurants/:restaurantId/reviews - List reviews for a restaurant
const getReviews = async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId, 10);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    const result = await reviewService.getReviewsByRestaurant(restaurantId);
    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }
    return res.status(200).json(result.reviews);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST /restaurants/:restaurantId/reviews - Create a review (auth required)
const createReview = async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId, 10);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }
    const commentStr = comment != null ? String(comment).trim() : "";
    if (commentStr.length > 500) {
      return res.status(400).json({ message: "Review comment must be at most 500 characters" });
    }

    const userId = req.user.id;
    const result = await reviewService.createReview(restaurantId, userId, {
      rating: parseInt(rating, 10),
      comment: commentStr || null,
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }
    if (result.flagged) {
      return res.status(result.status || 202).json({
        message: result.message || "Review submitted for moderation.",
        flagged: true,
      });
    }
    return res.status(201).json(result.review);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PUT /restaurants/:restaurantId/reviews/:reviewId - Update a review (auth required, owner only)
const updateReview = async (req, res) => {
  try {
    const reviewId = parseInt(req.params.reviewId, 10);
    if (isNaN(reviewId)) {
      return res.status(400).json({ message: "Invalid review ID" });
    }

    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }
    const commentStr = comment != null ? String(comment).trim() : "";
    if (commentStr.length > 500) {
      return res.status(400).json({ message: "Review comment must be at most 500 characters" });
    }

    const userId = req.user.id;
    const result = await reviewService.updateReview(reviewId, userId, {
      rating: parseInt(rating, 10),
      comment: commentStr || null,
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }
    if (result.flagged) {
      return res.status(result.status || 202).json({
        message: result.message || "Review update submitted for moderation.",
        flagged: true,
      });
    }
    return res.status(200).json(result.review);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// DELETE /restaurants/:restaurantId/reviews/:reviewId - Delete a review (auth required, owner only)
const deleteReview = async (req, res) => {
  try {
    const reviewId = parseInt(req.params.reviewId, 10);
    if (isNaN(reviewId)) {
      return res.status(400).json({ message: "Invalid review ID" });
    }

    const userId = req.user.id;
    const result = await reviewService.deleteReview(reviewId, userId);

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }
    return res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST /reviews/:id/flag - Flag review (user role)
const flagReview = async (req, res) => {
  try {
    const result = await reviewService.flagReview({
      reviewId: req.params.id,
      userId: req.user.id,
      reason: req.body.reason,
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }
    return res.status(result.status).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST /owner/reviews/:id/respond - Owner response on review
const respondToReviewAsOwner = async (req, res) => {
  try {
    const result = await reviewService.respondToReviewAsOwner({
      reviewId: req.params.id,
      ownerId: req.user.id,
      ownerResponse: req.body.owner_response,
    });

    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }
    return res.status(result.status).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getReviews,
  createReview,
  updateReview,
  deleteReview,
  flagReview,
  respondToReviewAsOwner,
};
