const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const favoriteController = require("../controllers/favoriteController");

router.get("/", requireAuth, favoriteController.getFavorites);
router.post("/", requireAuth, favoriteController.addFavorite);
router.delete("/:restaurantId", requireAuth, favoriteController.removeFavorite);

module.exports = router;
