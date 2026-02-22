// Handles API calls related to reviews.
// Keeps API logic separate from UI components.
import apiClient from "./apiClient";
// Fetch reviews for a specific restaurant
export async function getReviewsByRestaurantId(restaurantId) {
  const res = await apiClient.get(`/restaurants/${restaurantId}/reviews`);
  // Returns array of reviews
  return res.data;
}