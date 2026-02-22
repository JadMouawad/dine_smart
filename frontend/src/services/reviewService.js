import { apiRequest } from "./apiClient";

export async function getReviewsByRestaurantId(restaurantId) {
  return apiRequest(`/restaurants/${restaurantId}/reviews`);
}
