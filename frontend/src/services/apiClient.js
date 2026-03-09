const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || data.message || "Request failed");
    error.payload = data;
    throw error;
  }

  return data;
}
