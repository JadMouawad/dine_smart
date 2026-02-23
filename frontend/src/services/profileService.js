import { apiRequest } from "./apiClient";

export async function getProfile() {
  return apiRequest("/me");
}

export async function updateProfile(data) {
  return apiRequest("/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
