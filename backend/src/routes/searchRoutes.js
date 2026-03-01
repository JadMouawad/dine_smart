const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { authenticateToken } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

router.get('/', searchController.searchRestaurants);
router.post("/save", authenticateToken, authorizeRoles("user"), searchController.saveSearch);
router.get("/saved", authenticateToken, authorizeRoles("user"), searchController.getSavedSearches);
router.delete("/saved/:id", authenticateToken, authorizeRoles("user"), searchController.deleteSavedSearch);

module.exports = router;
