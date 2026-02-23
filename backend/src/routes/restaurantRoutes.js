const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { authenticateToken } = require('../middleware/authMiddleware');
const reviewRoutes = require("./reviewRoutes");

// Owner "my restaurant" routes (must be before /:id to avoid param conflict)
router.get('/mine', authenticateToken, authorizeRoles('owner'), restaurantController.getMyRestaurant);
router.put('/mine', authenticateToken, authorizeRoles('owner'), restaurantController.updateMyRestaurant);

// Owner-only routes
router.post('/', authenticateToken, authorizeRoles('owner'), restaurantController.createRestaurant);
router.put('/:id', authenticateToken, authorizeRoles('owner'), restaurantController.updateRestaurant);
router.delete('/:id', authenticateToken, authorizeRoles('owner'), restaurantController.deleteRestaurant);

// Public routes
router.get('/:id', restaurantController.getRestaurant);
router.get('/', restaurantController.getAllRestaurants);

// Review routes (nested under /restaurants/:restaurantId/reviews)
router.use('/:restaurantId/reviews', reviewRoutes);

module.exports = router;
