import apiClient from "./apiClient";
// Handles API calls related to rating summaries.

// Fetch average rating + count for a restaurant
export async function getRatingSummary(restaurantId) {
  const res = await apiClient.get(`/restaurants/${restaurantId}/rating`);
  return res.data;
}