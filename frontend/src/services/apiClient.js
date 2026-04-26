const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  const { headers: optionHeaders, body, ...restOptions } = options;
  const headers = new Headers(optionHeaders || {});

  if (body != null && !(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...restOptions,
    body,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || data.message || "Request failed");
    error.payload = data;
    error.status = res.status;
    throw error;
  }

  return data;
}
