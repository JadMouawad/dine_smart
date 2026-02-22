import { apiRequest } from "./apiClient";

export async function getReviewsByRestaurantId(restaurantId) {
  return apiRequest(`/restaurants/${restaurantId}/reviews`);
}

export async function createReview(restaurantId, { rating, comment }) {
  return apiRequest(`/restaurants/${restaurantId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating, comment }),
  });
}
