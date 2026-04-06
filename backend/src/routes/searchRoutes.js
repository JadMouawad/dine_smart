const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { authenticateToken } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

router.get('/', searchController.searchRestaurants);
router.post("/save", authenticateToken, authorizeRoles("user"), searchController.saveSearch);
router.get("/saved", authenticateToken, authorizeRoles("user"), searchController.getSavedSearches);
router.delete("/saved/:id", authenticateToken, authorizeRoles("user"), searchController.deleteSavedSearch);

// Recent searches (DB-backed, per user account)
router.get("/recent", authenticateToken, authorizeRoles("user"), searchController.getRecentSearches);
router.post("/recent", authenticateToken, authorizeRoles("user"), searchController.addRecentSearch);
router.delete("/recent", authenticateToken, authorizeRoles("user"), searchController.clearRecentSearches);
router.delete("/recent/:id", authenticateToken, authorizeRoles("user"), searchController.removeRecentSearch);

// Full search history (profile page)
router.get("/history", authenticateToken, authorizeRoles("user"), searchController.getSearchHistory);
router.delete("/history", authenticateToken, authorizeRoles("user"), searchController.clearSearchHistory);

module.exports = router;
