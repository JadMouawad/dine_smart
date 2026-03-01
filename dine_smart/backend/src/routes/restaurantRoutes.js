const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { authenticateToken } = require('../middleware/authMiddleware');

// Owner-only routes
router.post('/', authenticateToken, authorizeRoles('owner'), restaurantController.createRestaurant);
router.put('/:id', authenticateToken, authorizeRoles('owner'), restaurantController.updateRestaurant);
router.delete('/:id', authenticateToken, authorizeRoles('owner'), restaurantController.deleteRestaurant);

// Public routes
router.get('/:id', restaurantController.getRestaurant);
router.get('/', restaurantController.getAllRestaurants);

module.exports = router;
