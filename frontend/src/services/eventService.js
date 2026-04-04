import { apiRequest } from "./apiClient";

export function joinEvent(eventId, payload = {}) {
  return apiRequest(`/events/${eventId}/join`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveEvent(eventId) {
  return apiRequest(`/events/${eventId}/save`, {
    method: "POST",
  });
}

export function unsaveEvent(eventId) {
  return apiRequest(`/events/${eventId}/save`, {
    method: "DELETE",
  });
}

export function getSavedEvents() {
  return apiRequest("/events/saved", {
    method: "GET",
  });
}

export function getUserEventReservations() {
  return apiRequest("/events/reservations", { method: "GET" });
}

export function cancelUserEventReservation(eventId) {
  return apiRequest(`/events/${eventId}/reservations`, { method: "DELETE" });
}
