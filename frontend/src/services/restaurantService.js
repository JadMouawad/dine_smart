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

export async function getOwnerRestaurantTableConfig(restaurantId) {
  return apiRequest(`/owner/restaurants/${restaurantId}/table-config`, {
    method: "GET",
  });
}

export async function saveOwnerRestaurantTableConfig(restaurantId, data) {
  return apiRequest(`/owner/restaurants/${restaurantId}/table-config`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Search restaurants by name/description and optional cuisines
 * @param {string} query - Search query
 * @param {string|string[]} cuisines - Optional cuisine or comma-separated list (e.g. "Italian" or "Italian,Japanese")
 * @param {Object} filters - Advanced filters
 * @returns {Promise} Filtered restaurants
 */
export async function searchRestaurants(query, cuisines, filters = {}) {
  const params = new URLSearchParams();
  if (query != null && String(query).trim()) params.set("query", query.trim());
  if (cuisines != null && cuisines !== "All") {
    const list = Array.isArray(cuisines) ? cuisines : String(cuisines).split(",").map((c) => c.trim()).filter(Boolean);
    if (list.length) params.set("cuisine", list.join(","));
  }

  if (filters.minRating != null && filters.minRating !== "") {
    params.set("min_rating", String(filters.minRating));
  }
  if (Array.isArray(filters.priceRange) && filters.priceRange.length) {
    params.set("price_range", filters.priceRange.join(","));
  }
  if (Array.isArray(filters.dietarySupport) && filters.dietarySupport.length) {
    params.set("dietary_support", filters.dietarySupport.join(","));
  }
  if (filters.openNow === true) {
    params.set("open_now", "true");
  }
  if (filters.verifiedOnly === true) {
    params.set("verified_only", "true");
  }
  if (filters.availabilitySlot) {
    params.set("availability_slot", String(filters.availabilitySlot));
  }
  if (filters.availabilityDate) {
    params.set("availability_date", String(filters.availabilityDate));
  }
  if (filters.availabilityTime) {
    params.set("availability_time", String(filters.availabilityTime));
  }
  if (filters.latitude != null && filters.longitude != null) {
    params.set("latitude", String(filters.latitude));
    params.set("longitude", String(filters.longitude));
  }
  if (filters.distanceRadius != null && filters.distanceRadius !== "") {
    params.set("distance_radius", String(filters.distanceRadius));
  }
  if (filters.onlyLebanon === true) {
    params.set("only_lebanon", "true");
  }
  if (filters.sortBy) {
    params.set("sort_by", String(filters.sortBy));
  }

  return apiRequest(`/search?${params.toString()}`, { method: "GET" });
}

export async function getDiscoverFeed({ latitude, longitude, distanceRadius, limit = 8 } = {}) {
  const params = new URLSearchParams();
  if (latitude != null && longitude != null) {
    params.set("latitude", String(latitude));
    params.set("longitude", String(longitude));
  }
  if (distanceRadius != null) params.set("distance_radius", String(distanceRadius));
  if (limit != null) params.set("limit", String(limit));
  return apiRequest(`/discover?${params.toString()}`, { method: "GET" });
}

export async function getPublicEvents({ latitude, longitude, distanceRadius, limit = 40 } = {}) {
  const params = new URLSearchParams();
  if (latitude != null && longitude != null) {
    params.set("latitude", String(latitude));
    params.set("longitude", String(longitude));
  }
  if (distanceRadius != null) params.set("distance_radius", String(distanceRadius));
  if (limit != null) params.set("limit", String(limit));
  return apiRequest(`/events?${params.toString()}`, { method: "GET" });
}

export async function getRestaurantEvents(restaurantId) {
  return apiRequest(`/restaurants/${restaurantId}/events`, { method: "GET" });
}

export async function createOwnerEvent(data) {
  return apiRequest("/owner/events", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getOwnerEvents() {
  return apiRequest("/owner/events", { method: "GET" });
}

export async function updateOwnerEvent(eventId, data) {
  return apiRequest(`/owner/events/${eventId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteOwnerEvent(eventId) {
  return apiRequest(`/owner/events/${eventId}`, {
    method: "DELETE",
  });
}

export async function saveSearchFilters(name, filters) {
  return apiRequest("/search/save", {
    method: "POST",
    body: JSON.stringify({ name, filters }),
  });
}

export async function getSavedSearchFilters() {
  return apiRequest("/search/saved", {
    method: "GET",
  });
}

export async function deleteSavedSearchFilter(savedSearchId) {
  return apiRequest(`/search/saved/${savedSearchId}`, {
    method: "DELETE",
  });
}
