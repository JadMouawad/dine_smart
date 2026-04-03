
import React, { useEffect, useMemo, useState } from "react";
import { getReviewsByRestaurantId, respondToReviewAsOwner } from "../../services/reviewService";
import { getMyRestaurant } from "../../services/restaurantService";
import { DEFAULT_AVATAR } from "../../constants/avatar";

const FILLED_STAR = "\u2605";
const EMPTY_STAR = "\u2606";

function formatReviewDate(value) {
  if (!value) return "Date unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return parsed.toLocaleString();
}

function getReviewUserName(review) {
  return String(review.user_name || review.authorName || "Guest").trim() || "Guest";
}

export default function OwnerReviews() {
  const [restaurant, setRestaurant] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responseDrafts, setResponseDrafts] = useState({});
  const [editingResponses, setEditingResponses] = useState({});
  const [savingReviewId, setSavingReviewId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterUser, setFilterUser] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStars, setFilterStars] = useState("all");

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

  const userOptions = useMemo(() => {
    return [...new Set(reviews.map((review) => getReviewUserName(review)))].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      const userName = getReviewUserName(review);
      const createdAt = review.created_at || review.createdAt || "";
      const ratingValue = String(Number(review.rating) || 0);

      const matchesUser = !filterUser || userName === filterUser;
      const matchesDate = !filterDate || String(createdAt).slice(0, 10) === filterDate;
      const matchesStars = filterStars === "all" || ratingValue === filterStars;

      return matchesUser && matchesDate && matchesStars;
    });
  }, [reviews, filterDate, filterStars, filterUser]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterUser) count += 1;
    if (filterDate) count += 1;
    if (filterStars !== "all") count += 1;
    return count;
  }, [filterDate, filterStars, filterUser]);

  function resetFilters() {
    setFilterUser("");
    setFilterDate("");
    setFilterStars("all");
  }

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
    <div className="ownerTableConfigPage ownerReviewsPage">
      <h1 className="ownerProfile__title">Guest Reviews</h1>
      {error && <div className="fieldError">{error}</div>}
      {success && <div className="inlineToast">{success}</div>}

      <div className="ownerReviewsToolbar">
        <div className="ownerReviewsToolbar__summary">
          <div className="ownerReviewsToolbar__count">
            {filteredReviews.length} of {reviews.length} review{reviews.length === 1 ? "" : "s"}
          </div>
          <div className="ownerReviewsToolbar__hint">Filter by guest, date, or stars.</div>
        </div>

        <button
          type="button"
          className={`searchFilterBtn ownerReviewsToolbar__filterBtn${activeFilterCount ? " is-active" : ""}`}
          onClick={() => setFiltersOpen((prev) => !prev)}
          aria-expanded={filtersOpen}
          aria-controls="owner-reviews-filters"
        >
          ⚙ Filters
          {activeFilterCount > 0 && (
            <span className="searchFilterBtn__badge">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {filtersOpen && (
        <div id="owner-reviews-filters" className="ownerReviewsFilters">
          <label className="field ownerReviewsFilters__field">
            <span>User</span>
            <select className="select" value={filterUser} onChange={(event) => setFilterUser(event.target.value)}>
              <option value="">All users</option>
              {userOptions.map((userName) => (
                <option key={userName} value={userName}>
                  {userName}
                </option>
              ))}
            </select>
          </label>

          <label className="field ownerReviewsFilters__field">
            <span>Date</span>
            <input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
          </label>

          <label className="field ownerReviewsFilters__field">
            <span>Stars</span>
            <select className="select" value={filterStars} onChange={(event) => setFilterStars(event.target.value)}>
              <option value="all">All ratings</option>
              <option value="5">5 stars</option>
              <option value="4">4 stars</option>
              <option value="3">3 stars</option>
              <option value="2">2 stars</option>
              <option value="1">1 star</option>
            </select>
          </label>

          <div className="ownerReviewsFilters__actions">
            <button type="button" className="btn btn--ghost" onClick={resetFilters}>
              Reset Filters
            </button>
          </div>
        </div>
      )}

      <div className="ownerReviewsStack">
        {filteredReviews.length === 0 ? (
          <div className="menuSectionEmpty">
            {reviews.length === 0 ? "No reviews yet." : "No reviews match your filters."}
          </div>
        ) : (
          filteredReviews.map((review) => {
            const hasOwnerResponse = Boolean(String(review.owner_response || "").trim());
            const isEditing = Boolean(editingResponses[review.id]) || !hasOwnerResponse;
            const responseLabel = hasOwnerResponse ? "Edit response" : "Respond as Owner";
            const userName = getReviewUserName(review);

            return (
              <article className="ownerReviewCard" key={review.id}>
                <div className="ownerReviewCard__header">
                  <div className="ownerReviewCard__identity">
                    <div className="ownerReviewCard__avatar">
                      <img
                        className="ownerReviewCard__avatarImg"
                        src={review.profilePictureUrl || review.profile_picture_url || DEFAULT_AVATAR}
                        alt={`${userName} avatar`}
                      />
                    </div>

                    <div className="ownerReviewCard__identityText">
                      <div className="ownerReviewCard__name">{userName}</div>
                      <div className="ownerReviewCard__date">{formatReviewDate(review.created_at || review.createdAt)}</div>
                    </div>
                  </div>

                  <div className="ownerReviewCard__stars">
                    {FILLED_STAR.repeat(Math.max(0, Number(review.rating) || 0))}
                    {EMPTY_STAR.repeat(Math.max(0, 5 - (Number(review.rating) || 0)))}
                  </div>
                </div>

                <p className="ownerReviewCard__comment">{review.comment}</p>

                {review.owner_response && (
                  <div className="ownerResponseBlock">
                    <div className="ownerResponseBlock__label">Current Owner Response</div>
                    <div className="ownerResponseBlock__text">{review.owner_response}</div>
                  </div>
                )}

                {isEditing && (
                  <label className="field ownerReviewCard__responseField">
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

                <div className="formCard__actions ownerReviewCard__actions">
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
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
