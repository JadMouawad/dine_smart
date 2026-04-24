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

export async function redeemReward() {
  return apiRequest("/profile/rewards/redeem", {
    method: "POST",
  });
}

export async function deleteProfileAccount(confirmationText) {
  return apiRequest("/profile", {
    method: "DELETE",
    body: JSON.stringify({ confirmationText }),
  });
}
