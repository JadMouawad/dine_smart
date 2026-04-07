import { apiRequest } from "./apiClient";

export async function getReviewsByRestaurantId(restaurantId) {
  return apiRequest(`/restaurants/${restaurantId}/reviews`);
}

export async function createReview(restaurantId, { rating, comment }) {
  return apiRequest(`/restaurants/${restaurantId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating, comment }),
  });
}

export async function deleteReview(restaurantId, reviewId) {
  return apiRequest(`/restaurants/${restaurantId}/reviews/${reviewId}`, {
    method: "DELETE",
  });
}

export async function updateReview(restaurantId, reviewId, { rating, comment }) {
  return apiRequest(`/restaurants/${restaurantId}/reviews/${reviewId}`, {
    method: "PUT",
    body: JSON.stringify({ rating, comment }),
  });
}

export async function flagReview(reviewId, reason) {
  return apiRequest(`/reviews/${reviewId}/flag`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function respondToReviewAsOwner(reviewId, ownerResponse) {
  return apiRequest(`/owner/reviews/${reviewId}/respond`, {
    method: "POST",
    body: JSON.stringify({ owner_response: ownerResponse }),
  });
}
