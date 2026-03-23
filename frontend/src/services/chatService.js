import { apiRequest } from "./apiClient";

export async function sendChatMessage(message, filters = {}) {
  return apiRequest("/chat", {
    method: "POST",
    body: JSON.stringify({ message, filters }),
  });
}
