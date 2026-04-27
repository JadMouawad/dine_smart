import { apiRequest } from "./apiClient";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export async function getRestaurantsWithHealthCertificates() {
  return apiRequest("/admin/restaurants/health-certificates", { method: "GET" });
}

export async function verifyRestaurant(id) {
  return apiRequest(`/admin/restaurants/${id}/verify`, { method: "PUT" });
}

export async function unverifyRestaurant(id) {
  return apiRequest(`/admin/restaurants/${id}/unverify`, { method: "PUT" });
}

export async function downloadStatsCsv() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  const res = await fetch(`${API_BASE_URL}/admin/export/csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dinesmart_stats_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function getAdminStats() {
  return apiRequest("/admin/stats", { method: "GET" });
}

export async function getAdminAiSettings() {
  return apiRequest("/admin/ai/settings", { method: "GET" });
}

export async function updateAdminAiSettings(aiChatEnabled) {
  return apiRequest("/admin/ai/settings", {
    method: "PUT",
    body: JSON.stringify({ ai_chat_enabled: aiChatEnabled }),
  });
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

export async function unbanAdminUser(userId) {
  return apiRequest(`/admin/users/${userId}/unban`, { method: "PUT" });
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

export async function moderateFlaggedReview(flagId, { action, adminNotes = "", resolutionLabel = null } = {}) {
  return apiRequest(`/admin/flagged-reviews/${flagId}/action`, {
    method: "PUT",
    body: JSON.stringify({
      action,
      admin_notes: adminNotes || null,
      resolution_label: resolutionLabel,
    }),
  });
}

export async function bulkModerateFlaggedReviews({
  flagIds,
  action,
  adminNotes = "",
  resolutionLabel = null,
} = {}) {
  return apiRequest("/admin/flagged-reviews/bulk-action", {
    method: "PUT",
    body: JSON.stringify({
      flag_ids: flagIds,
      action,
      admin_notes: adminNotes || null,
      resolution_label: resolutionLabel,
    }),
  });
}


export async function getPendingDeletionRestaurants() {
  return apiRequest("/admin/restaurants/deletion-requests", { method: "GET" });
}

export async function approveRestaurantDeletion(restaurantId) {
  return apiRequest(`/admin/restaurants/${restaurantId}/deletion-requests/approve`, { method: "POST" });
}

export async function rejectRestaurantDeletion(restaurantId) {
  return apiRequest(`/admin/restaurants/${restaurantId}/deletion-requests/reject`, { method: "POST" });
}
