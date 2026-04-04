import React, { useEffect, useMemo, useState } from "react";
import {
  bulkModerateFlaggedReviews,
  deleteFlaggedReview,
  dismissFlaggedReview,
  getFlaggedReviews,
  moderateFlaggedReview,
} from "../../services/adminService";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

export default function FlaggedReviewsPage({ onPendingCountChange }) {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [confirmDeleteFlag, setConfirmDeleteFlag] = useState(null);
  const [selectedFlagIds, setSelectedFlagIds] = useState([]);

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

  const pendingCount = useMemo(() => flags.filter((flag) => flag.status === "pending").length, [flags]);

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
          flag.id === flagId
            ? {
                ...flag,
                status: "dismissed",
                moderator_action: "DISMISS",
                resolution_label: "FALSE_POSITIVE",
                resolved_at: new Date().toISOString(),
              }
            : flag
        )
      );
      setMessage("Flag dismissed.");
    } catch (err) {
      setError(err.message || "Failed to dismiss flag.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAction(flagId, action, successMessage) {
    setMessage("");
    setError("");
    setBusyId(flagId);
    try {
      await moderateFlaggedReview(flagId, { action });
      setFlags((prev) =>
        prev.map((flag) =>
          flag.id === flagId
            ? {
                ...flag,
                status: "resolved",
                moderator_action: action,
                resolved_at: new Date().toISOString(),
              }
            : flag
        )
      );
      setMessage(successMessage);
    } catch (err) {
      setError(err.message || "Failed moderation action.");
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

  async function handleBulk(action) {
    if (selectedFlagIds.length === 0) return;
    setMessage("");
    setError("");
    setBusyId("bulk");
    try {
      await bulkModerateFlaggedReviews({
        flagIds: selectedFlagIds,
        action,
      });

      if (action === "DELETE") {
        setFlags((prev) => prev.filter((flag) => !selectedFlagIds.includes(flag.id)));
      } else {
        setFlags((prev) =>
          prev.map((flag) =>
            selectedFlagIds.includes(flag.id)
              ? {
                  ...flag,
                  status: action === "DISMISS" ? "dismissed" : "resolved",
                  moderator_action: action,
                  resolved_at: new Date().toISOString(),
                }
              : flag
          )
        );
      }

      setSelectedFlagIds([]);
      setMessage(`Bulk action applied to ${selectedFlagIds.length} flag(s).`);
    } catch (err) {
      setError(err.message || "Failed bulk moderation action.");
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
          <div className="adminEntityCard__actions" style={{ marginBottom: 12 }}>
            <button
              className="btn btn--ghost"
              type="button"
              disabled={busyId === "bulk" || selectedFlagIds.length === 0}
              onClick={() => handleBulk("APPROVE_PUBLISH")}
            >
              Bulk Approve Publish
            </button>
            <button
              className="btn btn--gold"
              type="button"
              disabled={busyId === "bulk" || selectedFlagIds.length === 0}
              onClick={() => handleBulk("REQUIRE_CHANGES")}
            >
              Bulk Require Changes
            </button>
          </div>

          {flags.map((flag) => (
            <div className="formCard adminEntityCard" key={flag.id}>
              <label className="adminEntityCard__meta" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  disabled={flag.status !== "pending"}
                  checked={selectedFlagIds.includes(flag.id)}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSelectedFlagIds((prev) => {
                      if (checked) return [...prev, flag.id];
                      return prev.filter((id) => id !== flag.id);
                    });
                  }}
                />
                Select for bulk
              </label>

              <div className="adminEntityCard__title">{flag.restaurant_name}</div>
              <div className="adminEntityCard__meta">Reviewer: {flag.reviewer_name} | Rating {flag.rating}</div>
              <div className="adminEntityCard__meta">
                Flagged by: {flag.flagger_name} | {new Date(flag.created_at).toLocaleString()}
              </div>
              <div className="adminEntityCard__meta">
                Source: {(flag.flagged_by || flag.source_type || "unknown").toString()} | Type: {flag.flag_type || "N/A"} |
                Confidence: {flag.confidence != null ? `${flag.confidence}/100` : "N/A"}
              </div>
              <div className="adminEntityCard__meta">Suggested Action: {flag.suggested_action || "N/A"}</div>
              <div className="adminEntityCard__meta">
                <strong>Reason:</strong> {flag.reason}
              </div>
              {flag.snippet && (
                <div className="adminEntityCard__meta">
                  <strong>Snippet:</strong> {flag.snippet}
                </div>
              )}
              <div className="adminEntityCard__meta">
                <strong>Review:</strong> {flag.comment || "No comment"}
              </div>

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
                  className="btn btn--ghost"
                  type="button"
                  disabled={busyId === flag.id || flag.status !== "pending"}
                  onClick={() => handleAction(flag.id, "APPROVE_PUBLISH", "Review approved for publish.")}
                >
                  Approve Publish
                </button>
                <button
                  className="btn btn--ghost"
                  type="button"
                  disabled={busyId === flag.id || flag.status !== "pending"}
                  onClick={() => handleAction(flag.id, "REQUIRE_CHANGES", "Review marked as require changes.")}
                >
                  Require Changes
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
