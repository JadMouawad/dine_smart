import { apiRequest } from "./apiClient";

export async function getDiscoverRecommendations({ latitude, longitude, limit = 6 } = {}) {
  const params = new URLSearchParams();
  if (latitude != null && longitude != null) {
    params.set("latitude", String(latitude));
    params.set("longitude", String(longitude));
  }
  if (limit != null) params.set("limit", String(limit));
  return apiRequest(`/discover/recommendations?${params.toString()}`, { method: "GET" });
}
