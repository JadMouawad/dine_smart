import React, { useEffect, useState } from "react";
import { getReviewsByRestaurantId, respondToReviewAsOwner } from "../../services/reviewService";
import { getMyRestaurant } from "../../services/restaurantService";

const FILLED_STAR = "\u2605";
const EMPTY_STAR = "\u2606";

export default function OwnerReviews() {
  const [restaurant, setRestaurant] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responseDrafts, setResponseDrafts] = useState({});
  const [editingResponses, setEditingResponses] = useState({});
  const [savingReviewId, setSavingReviewId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadReviews() {
    setLoading(true);
    setError("");
    try {
      const ownedRestaurant = await getMyRestaurant();
      setRestaurant(ownedRestaurant);
      const list = await getReviewsByRestaurantId(ownedRestaurant.id);
      setReviews(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || "Failed to load reviews.");
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReviews();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadReviews();
    }, 20000);

    function onReviewChanged() {
      loadReviews();
    }

    window.addEventListener("ds:review-changed", onReviewChanged);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("ds:review-changed", onReviewChanged);
    };
  }, []);

  async function saveResponse(reviewId) {
    const response = String(responseDrafts[reviewId] || "").trim();
    if (!response) {
      setError("Owner response cannot be empty.");
      return;
    }

    setSavingReviewId(reviewId);
    setError("");
    setSuccess("");
    try {
      const hadResponse = reviews.some(
        (review) => review.id === reviewId && String(review.owner_response || "").trim()
      );
      const updated = await respondToReviewAsOwner(reviewId, response);
      setReviews((prev) =>
        prev.map((review) =>
          review.id === reviewId
            ? { ...review, owner_response: updated.owner_response, owner_response_date: updated.owner_response_date }
            : review
        )
      );
      setEditingResponses((prev) => ({ ...prev, [reviewId]: false }));
      setSuccess(hadResponse ? "Owner response updated." : "Owner response saved.");
    } catch (err) {
      setError(err.message || "Failed to save owner response.");
    } finally {
      setSavingReviewId(null);
    }
  }

  function startEditingResponse(reviewId, existingResponse) {
    setError("");
    setSuccess("");
    setResponseDrafts((prev) => ({
      ...prev,
      [reviewId]: prev[reviewId] ?? String(existingResponse || ""),
    }));
    setEditingResponses((prev) => ({ ...prev, [reviewId]: true }));
  }

  function cancelEditingResponse(reviewId) {
    setEditingResponses((prev) => ({ ...prev, [reviewId]: false }));
    setResponseDrafts((prev) => ({
      ...prev,
      [reviewId]: reviews.find((review) => review.id === reviewId)?.owner_response ?? "",
    }));
  }

  if (loading) {
    return (
      <div className="placeholderPage">
        <h1 className="placeholderPage__title">Reviews</h1>
        <p className="placeholderPage__text">Loading reviews...</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="placeholderPage">
        <h1 className="placeholderPage__title">Reviews</h1>
        <p className="placeholderPage__text">Create your restaurant profile first.</p>
      </div>
    );
  }

  return (
    <div className="ownerTableConfigPage">
      <h1 className="ownerProfile__title">Guest Reviews</h1>
      {error && <div className="fieldError">{error}</div>}
      {success && <div className="inlineToast">{success}</div>}

      <div className="ownerMenuSectionsStack">
        {reviews.length === 0 ? (
          <div className="menuSectionEmpty">No reviews yet.</div>
        ) : (
          reviews.map((review) => (
            <article className="menuSectionBlock" key={review.id}>
              {(() => {
                const hasOwnerResponse = Boolean(String(review.owner_response || "").trim());
                const isEditing = Boolean(editingResponses[review.id]) || !hasOwnerResponse;
                const responseLabel = hasOwnerResponse ? "Edit response" : "Respond as Owner";
                return (
                  <>
              <div className="menuSectionHeader">
                <button className="btn btn--gold ownerMenuSectionBtn" type="button">
                  {(review.user_name || review.authorName || "Guest")}
                </button>
              </div>
              <div className="reviewCardFull__stars">
                {FILLED_STAR.repeat(Math.max(0, Number(review.rating) || 0))}
                {EMPTY_STAR.repeat(Math.max(0, 5 - (Number(review.rating) || 0)))}
              </div>
              <p className="reservationCard__meta">
                {review.created_at || review.createdAt
                  ? new Date(review.created_at || review.createdAt).toLocaleString()
                  : "Date unavailable"}
              </p>
              <p>{review.comment}</p>

              {review.owner_response && (
                <div className="ownerResponseBlock">
                  <div className="ownerResponseBlock__label">Current Owner Response</div>
                  <div className="ownerResponseBlock__text">{review.owner_response}</div>
                </div>
              )}

              {isEditing && (
                <label className="field">
                  <span>{responseLabel}</span>
                  <textarea
                    className="textarea"
                    rows={3}
                    value={responseDrafts[review.id] ?? review.owner_response ?? ""}
                    onChange={(event) =>
                      setResponseDrafts((prev) => ({ ...prev, [review.id]: event.target.value }))
                    }
                    placeholder="Write a response to this review..."
                  />
                </label>
              )}

              <div className="formCard__actions">
                {hasOwnerResponse && !isEditing ? (
                  <button
                    className="btn btn--gold"
                    type="button"
                    onClick={() => startEditingResponse(review.id, review.owner_response)}
                  >
                    Edit Response
                  </button>
                ) : (
                  <>
                    <button
                      className="btn btn--gold"
                      type="button"
                      onClick={() => saveResponse(review.id)}
                      disabled={savingReviewId === review.id}
                    >
                      {savingReviewId === review.id ? "Saving..." : hasOwnerResponse ? "Save Changes" : "Save Response"}
                    </button>
                    {hasOwnerResponse && (
                      <button
                        className="btn btn--ghost"
                        type="button"
                        onClick={() => cancelEditingResponse(review.id)}
                        disabled={savingReviewId === review.id}
                      >
                        Cancel
                      </button>
                    )}
                  </>
                )}
              </div>
                  </>
                );
              })()}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
