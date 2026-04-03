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

export async function getReservationAvailability({ restaurantId, date, time, partySize, seatingPreference }) {
  const params = new URLSearchParams();
  params.set("restaurant_id", String(restaurantId));
  params.set("date", date);
  params.set("time", time);
  if (partySize != null) params.set("party_size", String(partySize));
  if (seatingPreference) params.set("seating_preference", String(seatingPreference));
  return apiRequest(`/reservations/availability?${params.toString()}`, {
    method: "GET",
  });
}

export async function joinWaitlist({ restaurantId, date, time, partySize }) {
  return apiRequest("/reservations/waitlist", {
    method: "POST",
    body: JSON.stringify({
      restaurant_id: restaurantId,
      date,
      time,
      party_size: partySize,
    }),
  });
}

export async function leaveWaitlist({ restaurantId, date, time }) {
  return apiRequest("/reservations/waitlist", {
    method: "DELETE",
    body: JSON.stringify({
      restaurant_id: restaurantId,
      date,
      time,
    }),
  });
}


export async function getOwnerReservations() {
  return apiRequest("/owner/reservations", { method: "GET" });
}

export async function updateOwnerReservationStatus(reservationId, action) {
  return apiRequest(`/owner/reservations/${reservationId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

export async function markOwnerReservationNoShow(reservationId) {
  return apiRequest(`/owner/reservations/${reservationId}/no-show`, {
    method: "PATCH",
  });
}

export async function getOwnerSlotAdjustment({ restaurantId, date, time, seatingPreference }) {
  const params = new URLSearchParams();
  params.set("date", date);
  params.set("time", time);
  if (seatingPreference) params.set("seating_preference", seatingPreference);
  return apiRequest(`/owner/restaurants/${restaurantId}/slot-adjustments?${params.toString()}`, {
    method: "GET",
  });
}

export async function saveOwnerSlotAdjustment(restaurantId, data) {
  return apiRequest(`/owner/restaurants/${restaurantId}/slot-adjustments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
