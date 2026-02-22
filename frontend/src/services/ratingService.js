import { apiRequest } from "./apiClient";

export async function getRatingSummary(restaurantId) {
  return apiRequest(`/restaurants/${restaurantId}/rating`);
}
