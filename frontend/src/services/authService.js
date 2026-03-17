import { apiRequest } from "./apiClient";

// API endpoints
export function registerUser({ name, email, password, role, latitude, longitude, phone, adminSignupKey }) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, role, latitude, longitude, phone, admin_signup_key: adminSignupKey }),
  });
}

export function phoneExists(phone) {
  const params = new URLSearchParams({ phone });
  return apiRequest(`/auth/phone-exists?${params.toString()}`, {
    method: "GET",
  });
}

export function loginUser({ email, password }) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function googleAuth({ idToken, role }) {
  return apiRequest("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken, role }),
  });
}

export function getCurrentUser() {
  return apiRequest("/me");
}
