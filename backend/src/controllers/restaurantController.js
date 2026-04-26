// src/controllers/restaurantController.js
const crypto = require("crypto");
const restaurantService = require("../services/restaurantService");
const subscriptionService = require("../services/subscriptionService");
const { extractMenuItems, normalizeMenuSections } = require("../utils/menuUtils");

const createRestaurant = async (req, res) => {
  try {
    const data = { ...req.body, ownerId: req.user.id };
    const restaurant = await restaurantService.createRestaurant(data);
    res.status(201).json(restaurant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await restaurantService.getAllRestaurants();
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getRestaurant = async (req, res) => {
  try {
    const restaurant = await restaurantService.getRestaurantById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/restaurants/mine — returns the restaurant owned by the logged-in owner
const getMyRestaurant = async (req, res) => {
  try {
    const restaurant = await restaurantService.getRestaurantByOwnerId(req.user.id);
    if (!restaurant) return res.status(404).json({ message: "No restaurant found" });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/restaurants/mine — update the restaurant owned by the logged-in owner
const updateMyRestaurant = async (req, res) => {
  try {
    const restaurant = await restaurantService.getRestaurantByOwnerId(req.user.id);
    if (!restaurant) return res.status(404).json({ message: "No restaurant found" });

    const incomingMenu = req.body.menu_sections ?? req.body.menu;
    const hasMenuUpdate = incomingMenu !== undefined;
    const previousMenu = normalizeMenuSections(restaurant.menu_sections || restaurant.menu || []);

    const updated = await restaurantService.updateRestaurant(restaurant.id, {
      ...req.body,
    });

    if (hasMenuUpdate) {
      const updatedMenu = normalizeMenuSections(updated.menu_sections || incomingMenu || []);
      const menuPayload = JSON.stringify(updatedMenu);
      const menuFingerprint = crypto.createHash("sha256").update(menuPayload).digest("hex");
      const restaurantName = updated.name || restaurant.name || "Restaurant";

      try {
        await subscriptionService.sendSubscriptionUpdateOnce({
          updateType: "news",
          subject: `${restaurantName} updated its menu`,
          message: `${restaurantName} just refreshed its menu. Explore new dishes and favorites today.`,
          entityType: "restaurant_menu",
          entityId: updated.id,
          fingerprint: menuFingerprint,
        });
      } catch (error) {
        console.warn("Failed to send menu update subscription update:", error.message);
      }

      const previousItems = extractMenuItems(previousMenu);
      const updatedItems = extractMenuItems(updatedMenu);
      const previousMap = new Map(previousItems.map((item) => [item.key, item]));
      const reductions = [];
      updatedItems.forEach((item) => {
        const before = previousMap.get(item.key);
        if (!before || before.price == null || item.price == null) return;
        if (item.currency !== before.currency) return;
        if (item.price < before.price) {
          reductions.push({
            name: item.name,
            oldPrice: before.price,
            newPrice: item.price,
            currency: item.currency,
          });
        }
      });

      if (reductions.length) {
        const sorted = reductions
          .sort((a, b) => (a.newPrice - a.oldPrice) - (b.newPrice - b.oldPrice))
          .slice(0, 3);
        const lines = sorted.map(
          (item) => `${item.name}: ${item.oldPrice} → ${item.newPrice} ${item.currency}`
        );
        const offerFingerprint = crypto
          .createHash("sha256")
          .update(JSON.stringify(reductions))
          .digest("hex");

        try {
          await subscriptionService.sendSubscriptionUpdateOnce({
            updateType: "offers",
            subject: `${restaurantName} just dropped prices`,
            message: `Good news! ${restaurantName} reduced prices on ${reductions.length} item(s).\n${lines.join("\n")}`,
            entityType: "restaurant_offer",
            entityId: updated.id,
            fingerprint: offerFingerprint,
          });
        } catch (error) {
          console.warn("Failed to send offer subscription update:", error.message);
        }
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateRestaurant = async (req, res) => {
  try {
    const updated = await restaurantService.updateRestaurant(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteRestaurant = async (req, res) => {
  try {
    const deleted = await restaurantService.deleteRestaurant(req.params.id);
    res.json(deleted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const TABLE_CONFIG_KEYS = [
  "total_capacity",
  "table_2_person",
  "table_4_person",
  "table_6_person",
  "indoor_capacity",
  "outdoor_capacity",
];

const parseTableConfigPayload = (payload) => {
  const parsed = {};
  for (const key of TABLE_CONFIG_KEYS) {
    if (payload[key] == null || payload[key] === "") {
      return { error: `${key} is required` };
    }
    const value = parseInt(payload[key], 10);
    if (Number.isNaN(value)) {
      return { error: `${key} must be a number` };
    }
    if (key === "total_capacity" && value <= 0) {
      return { error: "total_capacity must be greater than 0" };
    }
    if (key !== "total_capacity" && value < 0) {
      return { error: `${key} cannot be negative` };
    }
    parsed[key] = value;
  }

  if (parsed.indoor_capacity + parsed.outdoor_capacity > parsed.total_capacity) {
    return { error: "indoor_capacity and outdoor_capacity cannot exceed total_capacity" };
  }

  return { parsed };
};

const getOwnerRestaurantTableConfig = async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id, 10);
    if (Number.isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    const ownedRestaurant = await restaurantService.getRestaurantByIdAndOwnerId(restaurantId, req.user.id);
    if (!ownedRestaurant) {
      return res.status(403).json({ message: "Forbidden: You can only manage your own restaurant" });
    }

    const config = await restaurantService.getTableConfigByRestaurantId(restaurantId);
    if (!config) {
      return res.status(404).json({ message: "Table configuration not found" });
    }

    return res.status(200).json(config);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const upsertOwnerRestaurantTableConfig = async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id, 10);
    if (Number.isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    const ownedRestaurant = await restaurantService.getRestaurantByIdAndOwnerId(restaurantId, req.user.id);
    if (!ownedRestaurant) {
      return res.status(403).json({ message: "Forbidden: You can only manage your own restaurant" });
    }

    const { parsed, error } = parseTableConfigPayload(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const saved = await restaurantService.upsertTableConfigByRestaurantId(restaurantId, parsed);
    return res.status(200).json(saved);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createRestaurant,
  getAllRestaurants,
  getRestaurant,
  getMyRestaurant,
  updateMyRestaurant,
  updateRestaurant,
  deleteRestaurant,
  getOwnerRestaurantTableConfig,
  upsertOwnerRestaurantTableConfig,
  requestRestaurantDeletion,
};

async function requestRestaurantDeletion(req, res) {
  try {
    const result = await restaurantService.requestRestaurantDeletion({ ownerId: req.user.id });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(200).json(result.data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
