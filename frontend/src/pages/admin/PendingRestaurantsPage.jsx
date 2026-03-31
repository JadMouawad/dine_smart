import React, { useEffect, useMemo, useState } from "react";
import {
  approvePendingRestaurant,
  getPendingRestaurants,
  rejectPendingRestaurant,
} from "../../services/adminService";

export default function PendingRestaurantsPage({ onPendingCountChange }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getPendingRestaurants();
        if (!cancelled) setRestaurants(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load pending restaurants.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onPendingCountChange?.(restaurants.length);
  }, [restaurants.length, onPendingCountChange]);

  const emptyMessage = useMemo(() => {
    if (loading) return "Loading pending restaurants...";
    if (restaurants.length === 0) return "No pending restaurants.";
    return "";
  }, [loading, restaurants.length]);

  async function handleApprove(id) {
    setSuccess("");
    setError("");
    setBusyId(id);
    try {
      await approvePendingRestaurant(id);
      setRestaurants((prev) => prev.filter((item) => item.id !== id));
      setSuccess("Restaurant approved.");
    } catch (err) {
      setError(err.message || "Failed to approve restaurant.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRejectSubmit(event) {
    event.preventDefault();
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (reason.length < 20) {
      setRejectError("Rejection reason must be at least 20 characters.");
      return;
    }

    setBusyId(rejectTarget.id);
    setRejectError("");
    setError("");
    setSuccess("");
    try {
      await rejectPendingRestaurant(rejectTarget.id, reason);
      setRestaurants((prev) => prev.filter((item) => item.id !== rejectTarget.id));
      setSuccess("Restaurant rejected.");
      setRejectTarget(null);
      setRejectReason("");
    } catch (err) {
      setRejectError(err.message || "Failed to reject restaurant.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="adminPage">
      <h1 className="ownerProfile__title">Pending Restaurants</h1>
      {success && <div className="inlineToast">{success}</div>}
      {error && <div className="fieldError">{error}</div>}

      {emptyMessage ? (
        <p className="placeholderPage__text">{emptyMessage}</p>
      ) : (
        <div className="adminCardList">
          {restaurants.map((restaurant) => (
            <div className="formCard adminEntityCard" key={restaurant.id}>
              <div className="adminEntityCard__title">{restaurant.name}</div>
              <div className="adminEntityCard__meta">
                {restaurant.cuisine || "Cuisine not set"} • {restaurant.address || "Address not set"}
              </div>
              <div className="adminEntityCard__meta">
                Owner: {restaurant.owner_name || "Unknown"} ({restaurant.owner_email || "No email"})
              </div>
              {restaurant.business_license_url && (
                <div className="adminEntityCard__meta">
                  License:{" "}
                  <a href={restaurant.business_license_url} target="_blank" rel="noreferrer">
                    {restaurant.business_license_name || "View uploaded file"}
                  </a>
                </div>
              )}
              <div className="adminEntityCard__meta">
                Submitted: {new Date(restaurant.created_at).toLocaleDateString()}
              </div>

              <div className="adminEntityCard__actions">
                <button
                  className="btn btn--gold"
                  type="button"
                  onClick={() => handleApprove(restaurant.id)}
                  disabled={busyId === restaurant.id}
                >
                  {busyId === restaurant.id ? "Saving..." : "Approve"}
                </button>
                <button
                  className="btn btn--ghost"
                  type="button"
                  onClick={() => {
                    setRejectTarget(restaurant);
                    setRejectReason("");
                    setRejectError("");
                  }}
                  disabled={busyId === restaurant.id}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectTarget && (
        <div className="modal is-open" role="dialog" aria-modal="true">
          <div className="modal__backdrop" onClick={() => setRejectTarget(null)} />
          <div className="modal__panel" role="document">
            <button className="modal__close" type="button" onClick={() => setRejectTarget(null)} aria-label="Close">
              X
            </button>
            <h2 className="modal__title">Reject Restaurant</h2>
            <p className="modal__subtitle">{rejectTarget.name}</p>
            <form className="form" onSubmit={handleRejectSubmit}>
              <label className="field">
                <span>Rejection reason</span>
                <textarea
                  className="textarea"
                  rows={4}
                  minLength={20}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide a clear reason (minimum 20 characters)."
                  required
                />
              </label>
              {rejectError && <div className="fieldError">{rejectError}</div>}
              <button className="btn btn--gold btn--xl" type="submit" disabled={busyId === rejectTarget.id}>
                {busyId === rejectTarget.id ? "Saving..." : "Confirm Reject"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

