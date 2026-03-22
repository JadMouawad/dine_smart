import { apiRequest } from "./apiClient";

/**
 * Fetch all favorited restaurants for the logged-in user.
 * Returns an array of restaurant objects.
 */
export async function getFavorites() {
  return apiRequest("/me/favorites");
}

/**
 * Add a restaurant to favorites.
 * @param {number} restaurantId
 */
export async function addFavorite(restaurantId) {
  return apiRequest("/me/favorites", {
    method: "POST",
    body: JSON.stringify({ restaurantId }),
  });
}

/**
 * Remove a restaurant from favorites.
 * @param {number} restaurantId
 */
export async function removeFavorite(restaurantId) {
  return apiRequest(`/me/favorites/${restaurantId}`, {
    method: "DELETE",
  });
}
