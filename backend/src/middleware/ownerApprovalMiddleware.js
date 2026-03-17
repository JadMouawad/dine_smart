const restaurantService = require("../services/restaurantService");

const requireApprovedRestaurant = async (req, res, next) => {
  try {
    const restaurant = await restaurantService.getRestaurantByOwnerId(req.user.id);
    if (!restaurant) {
      return res.status(404).json({ message: "No restaurant found for this owner" });
    }

    if (restaurant.approval_status !== "approved" || restaurant.is_verified !== true) {
      return res.status(403).json({
        message: "Restaurant pending approval. This feature is locked until approval.",
      });
    }

    return next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  requireApprovedRestaurant,
};
