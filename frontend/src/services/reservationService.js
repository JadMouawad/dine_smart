import { apiRequest } from "./apiClient";

export async function createReservation({
  restaurantId,
  date,
  time,
  partySize,
  seatingPreference,
  specialRequest,
}) {
  return apiRequest("/reservations", {
    method: "POST",
    body: JSON.stringify({
      restaurant_id: restaurantId,
      date,
      time,
      party_size: partySize,
      seating_preference: seatingPreference || null,
      special_request: specialRequest || null,
    }),
  });
}

export async function getReservationsByUserId(userId) {
  return apiRequest(`/reservations/user/${userId}`, { method: "GET" });
}

export async function cancelReservation(reservationId) {
  return apiRequest(`/reservations/${reservationId}`, {
    method: "DELETE",
  });
}

export async function getReservationAvailability({ restaurantId, date, time, partySize }) {
  const params = new URLSearchParams();
  params.set("restaurant_id", String(restaurantId));
  params.set("date", date);
  params.set("time", time);
  if (partySize != null) params.set("party_size", String(partySize));
  return apiRequest(`/reservations/availability?${params.toString()}`, {
    method: "GET",
  });
}
