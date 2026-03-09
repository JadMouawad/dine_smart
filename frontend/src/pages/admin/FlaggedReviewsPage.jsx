import React, { useEffect, useMemo, useState } from "react";
import {
  deleteFlaggedReview,
  dismissFlaggedReview,
  getFlaggedReviews,
} from "../../services/adminService";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

export default function FlaggedReviewsPage({ onPendingCountChange }) {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [confirmDeleteFlag, setConfirmDeleteFlag] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getFlaggedReviews();
        if (!cancelled) setFlags(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load flagged reviews.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingCount = useMemo(
    () => flags.filter((flag) => flag.status === "pending").length,
    [flags]
  );

  useEffect(() => {
    onPendingCountChange?.(pendingCount);
  }, [pendingCount, onPendingCountChange]);

  async function handleDismiss(flagId) {
    setMessage("");
    setError("");
    setBusyId(flagId);
    try {
      await dismissFlaggedReview(flagId);
      setFlags((prev) =>
        prev.map((flag) =>
          flag.id === flagId ? { ...flag, status: "dismissed", resolved_at: new Date().toISOString() } : flag
        )
      );
      setMessage("Flag dismissed.");
    } catch (err) {
      setError(err.message || "Failed to dismiss flag.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(flagId) {
    setMessage("");
    setError("");
    setBusyId(flagId);
    try {
      const response = await deleteFlaggedReview(flagId);
      const deletedReviewId = response.review_id;
      setFlags((prev) => prev.filter((flag) => flag.review_id !== deletedReviewId));
      setMessage("Review deleted.");
    } catch (err) {
      setError(err.message || "Failed to delete review.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="adminPage">
      <h1 className="ownerProfile__title">Flagged Reviews</h1>
      {message && <div className="inlineToast">{message}</div>}
      {error && <div className="fieldError">{error}</div>}

      {loading ? (
        <p className="placeholderPage__text">Loading flagged reviews...</p>
      ) : flags.length === 0 ? (
        <p className="placeholderPage__text">No flagged reviews.</p>
      ) : (
        <div className="adminCardList">
          {flags.map((flag) => (
            <div className="formCard adminEntityCard" key={flag.id}>
              <div className="adminEntityCard__title">{flag.restaurant_name}</div>
              <div className="adminEntityCard__meta">
                Reviewer: {flag.reviewer_name} • Rating {flag.rating}
              </div>
              <div className="adminEntityCard__meta">
                Flagged by: {flag.flagger_name} • {new Date(flag.created_at).toLocaleString()}
              </div>
              <div className="adminEntityCard__meta"><strong>Reason:</strong> {flag.reason}</div>
              <div className="adminEntityCard__meta"><strong>Review:</strong> {flag.comment || "No comment"}</div>

              <div className="adminEntityCard__actions">
                <span className={`statusBadge statusBadge--${flag.status === "pending" ? "no-show" : "completed"}`}>
                  {flag.status}
                </span>

                <button
                  className="btn btn--ghost"
                  type="button"
                  disabled={busyId === flag.id || flag.status !== "pending"}
                  onClick={() => handleDismiss(flag.id)}
                >
                  Dismiss
                </button>
                <button
                  className="btn btn--gold"
                  type="button"
                  disabled={busyId === flag.id || flag.status !== "pending"}
                  onClick={() => setConfirmDeleteFlag(flag)}
                >
                  Delete Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteFlag}
        title="Delete review?"
        message="Are you sure you want to delete this review? This action cannot be undone."
        confirmLabel="Yes"
        cancelLabel="No"
        busy={busyId === confirmDeleteFlag?.id}
        busyLabel="Deleting..."
        onConfirm={() => {
          if (!confirmDeleteFlag) return;
          handleDelete(confirmDeleteFlag.id);
          setConfirmDeleteFlag(null);
        }}
        onCancel={() => setConfirmDeleteFlag(null)}
      />
    </div>
  );
}

