import { apiRequest } from "./apiClient";

export async function getAdminStats() {
  return apiRequest("/admin/stats", { method: "GET" });
}

export async function getAdminRecentActivity(limit = 10) {
  return apiRequest(`/admin/activity?limit=${encodeURIComponent(limit)}`, { method: "GET" });
}

export async function getPendingRestaurants() {
  return apiRequest("/admin/restaurants/pending", { method: "GET" });
}

export async function approvePendingRestaurant(restaurantId) {
  return apiRequest(`/admin/restaurants/${restaurantId}/approve`, { method: "PUT" });
}

export async function rejectPendingRestaurant(restaurantId, rejectionReason) {
  return apiRequest(`/admin/restaurants/${restaurantId}/reject`, {
    method: "PUT",
    body: JSON.stringify({ rejection_reason: rejectionReason }),
  });
}

export async function getAdminUsers({ page = 1, limit = 10, search = "", role = "", suspended = "" } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (search) params.set("search", search);
  if (role) params.set("role", role);
  if (suspended !== "") params.set("suspended", String(suspended));

  return apiRequest(`/admin/users?${params.toString()}`, { method: "GET" });
}

export async function getAdminUserDetails(userId) {
  return apiRequest(`/admin/users/${userId}`, { method: "GET" });
}

export async function suspendAdminUser(userId) {
  return apiRequest(`/admin/users/${userId}/suspend`, { method: "PUT" });
}

export async function deleteAdminUser(userId) {
  return apiRequest(`/admin/users/${userId}`, { method: "DELETE" });
}

export async function getFlaggedReviews() {
  return apiRequest("/admin/flagged-reviews", { method: "GET" });
}

export async function dismissFlaggedReview(flagId, adminNotes = "") {
  return apiRequest(`/admin/flagged-reviews/${flagId}/dismiss`, {
    method: "PUT",
    body: JSON.stringify({ admin_notes: adminNotes || null }),
  });
}

export async function deleteFlaggedReview(flagId) {
  return apiRequest(`/admin/flagged-reviews/${flagId}`, { method: "DELETE" });
}

