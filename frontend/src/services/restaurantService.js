import { apiRequest } from "./apiClient";

/**
 * Restaurant Service
 * Handles all restaurant-related API calls
 */

/**
 * Get all restaurants
 * @returns {Promise} List of restaurants
 */
export async function getAllRestaurants() {
  return apiRequest("/restaurants", {
    method: "GET"
  });
}

/**
 * Get a single restaurant by ID
 * @param {number} id - Restaurant ID
 * @returns {Promise} Restaurant details
 */
export async function getRestaurantById(id) {
  return apiRequest(`/restaurants/${id}`, {
    method: "GET"
  });
}

/**
 * Create a new restaurant (owner only)
 * @param {Object} data - { name, description, cuisine, address }
 * @returns {Promise} Created restaurant
 */
export async function createRestaurant(data) {
  return apiRequest("/restaurants", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMyRestaurant() {
  return apiRequest("/restaurants/mine");
}

export async function updateMyRestaurant(data) {
  return apiRequest("/restaurants/mine", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Search restaurants (for future implementation)
 * @param {string} query - Search query
 * @returns {Promise} Filtered restaurants
 */
export async function searchRestaurants(query) {
  return apiRequest(`/restaurants?search=${encodeURIComponent(query)}`, {
    method: "GET"
  });
}

/**
 * Filter restaurants by cuisine (for future implementation)
 * @param {string} cuisine - Cuisine type
 * @returns {Promise} Filtered restaurants
 */
export async function getRestaurantsByCuisine(cuisine) {
  return apiRequest(`/restaurants?cuisine=${encodeURIComponent(cuisine)}`, {
    method: "GET"
  });
}
