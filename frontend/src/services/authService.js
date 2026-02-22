import { apiRequest } from "./apiClient";

// API endpoints
export function registerUser({ name, email, password, role }) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, role }),
  });
}

export function loginUser({ email, password }) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function googleAuth({ idToken }) {
  return apiRequest("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
}

export function getCurrentUser() {
  return apiRequest("/me");
}