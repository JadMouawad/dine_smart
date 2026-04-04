import { apiRequest } from "./apiClient";

export async function sendChatMessage(message, options = {}) {
  const { filters = {}, location = null, history = [] } = options;

  return apiRequest("/chat", {
    method: "POST",
    body: JSON.stringify({ message, filters, location, history }),
  });
}
