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
 * Search restaurants by name/description and optional cuisines
 * @param {string} query - Search query
 * @param {string|string[]} cuisines - Optional cuisine or comma-separated list (e.g. "Italian" or "Italian,Japanese")
 * @returns {Promise} Filtered restaurants
 */
export async function searchRestaurants(query, cuisines) {
  const params = new URLSearchParams();
  if (query != null && String(query).trim()) params.set("query", query.trim());
  if (cuisines != null && cuisines !== "All") {
    const list = Array.isArray(cuisines) ? cuisines : String(cuisines).split(",").map((c) => c.trim()).filter(Boolean);
    if (list.length) params.set("cuisine", list.join(","));
  }
  return apiRequest(`/search?${params.toString()}`, { method: "GET" });
}
