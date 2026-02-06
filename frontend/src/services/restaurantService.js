import { apiRequest } from "./apiClient";

export function getRestaurants({ q, cuisine, minRating } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (cuisine) params.set("cuisine", cuisine);
  if (minRating) params.set("minRating", minRating);
  const query = params.toString();
  return apiRequest(`/restaurants${query ? `?${query}` : ""}`);
}

export function getRestaurantById(id) {
  return apiRequest(`/restaurants/${id}`);
}
