import React, { useEffect, useMemo, useState } from "react";
import {
  approvePendingRestaurant,
  getPendingRestaurants,
  rejectPendingRestaurant,
  getPendingDeletionRestaurants,
  approveRestaurantDeletion,
  rejectRestaurantDeletion,
} from "../../services/adminService";

function dataUrlToBlobUrl(dataUrl) {
  const raw = String(dataUrl || "").trim();
  if (!raw.startsWith("data:")) return raw;
  const [meta, content] = raw.split(",", 2);
  if (!meta || content == null) return raw;
  const mimeMatch = meta.match(/^data:([^;]+)(;base64)?$/i);
  const mimeType = mimeMatch?.[1] || "application/octet-stream";
  const isBase64 = /;base64$/i.test(meta);
  try {
    const byteString = isBase64 ? atob(content) : decodeURIComponent(content);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  } catch {
    return raw;
  }
}

export default function PendingRestaurantsPage({ onPendingCountChange }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [deletionBusyId, setDeletionBusyId] = useState(null);
  const [activeTab, setActiveTab] = useState("approvals");

  useEffect(() => {
    getPendingDeletionRestaurants()
      .then((data) => setDeletionRequests(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || "Failed to load deletion requests."));
  }, []);

  async function handleApproveDeletion(restaurantId) {
    setDeletionBusyId(restaurantId);
    try {
      await approveRestaurantDeletion(restaurantId);
      setDeletionRequests((prev) => prev.filter((r) => r.id !== restaurantId));
    } catch (err) {
      setError(err.message || "Failed to approve deletion.");
    } finally {
      setDeletionBusyId(null);
    }
  }

  async function handleRejectDeletion(restaurantId) {
    setDeletionBusyId(restaurantId);
    try {
      await rejectRestaurantDeletion(restaurantId);
      setDeletionRequests((prev) => prev.filter((r) => r.id !== restaurantId));
    } catch (err) {
      setError(err.message || "Failed to reject deletion.");
    } finally {
      setDeletionBusyId(null);
    }
  }

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
      <h1 className="ownerProfile__title">Restaurants</h1>

      {success && <div className="inlineToast">{success}</div>}
      {error && <div className="fieldError">{error}</div>}

      <div className="ownerReservationSectionSwitcher" style={{ marginBottom: "1.5rem" }}>
        <button
          type="button"
          className={`ownerReservationSectionSwitcher__btn ${activeTab === "approvals" ? "is-active" : ""}`}
          onClick={() => setActiveTab("approvals")}
        >
          Pending Approvals
          {restaurants.length > 0 && (
            <span className="searchFilterBtn__badge" style={{ marginLeft: 6 }}>{restaurants.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`ownerReservationSectionSwitcher__btn ${activeTab === "deletions" ? "is-active" : ""}`}
          onClick={() => setActiveTab("deletions")}
        >
          Deletion Requests
          {deletionRequests.length > 0 && (
            <span className="searchFilterBtn__badge" style={{ marginLeft: 6 }}>{deletionRequests.length}</span>
          )}
        </button>
      </div>

      {activeTab === "approvals" && (
        <>
          <p className="adminPage__subtitle" style={{ marginBottom: "1rem" }}>
            Review complete restaurant information before granting access. Business licenses are required for approval.
          </p>
          {emptyMessage ? (
            <p className="placeholderPage__text">{emptyMessage}</p>
          ) : (
            <div className="adminCardList">
              {restaurants.map((restaurant) => (
                <RestaurantApprovalCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  busy={busyId === restaurant.id}
                  onApprove={() => handleApprove(restaurant.id)}
                  onReject={() => {
                    setRejectTarget(restaurant);
                    setRejectReason("");
                    setRejectError("");
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "deletions" && (
        <>
          <p className="adminPage__subtitle" style={{ marginBottom: "1rem" }}>
            Restaurants that have requested to be permanently deleted. Approve to delete or reject to cancel the request.
          </p>
          {deletionRequests.length === 0 ? (
            <p className="placeholderPage__text">No pending deletion requests.</p>
          ) : (
            <div className="adminCardList">
              {deletionRequests.map((r) => (
                <div key={r.id} className="reservationCard" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="reservationCard__main">
                    <div>
                      <div className="reservationCard__name">{r.name}</div>
                      <div className="reservationCard__meta">{r.address}</div>
                      <div className="reservationCard__meta">Owner: {r.owner_name} · {r.owner_email}</div>
                      <div className="reservationCard__meta">
                        Requested: {new Date(r.deletion_requested_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="statusBadge statusBadge--pending">Pending Deletion</span>
                  </div>
                  <div className="reservationCard__actions">
                    <button
                      className="btn btn--ghost"
                      type="button"
                      disabled={deletionBusyId === r.id}
                      onClick={() => handleApproveDeletion(r.id)}
                      style={{ color: "var(--color-danger, #e05252)" }}
                    >
                      {deletionBusyId === r.id ? "Working..." : "Approve & Delete"}
                    </button>
                    <button
                      className="btn btn--ghost"
                      type="button"
                      disabled={deletionBusyId === r.id}
                      onClick={() => handleRejectDeletion(r.id)}
                    >
                      Reject Request
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
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

function RestaurantApprovalCard({ restaurant, busy, onApprove, onReject }) {
  function openBusinessLicense() {
    const url = restaurant.business_license_url;
    if (!url) return;
    const blobUrl = dataUrlToBlobUrl(url);
    window.open(blobUrl, "_blank", "noreferrer");
  }

  function openHealthCertificate() {
    const url = restaurant.health_certificate_url;
    if (!url) return;
    const blobUrl = dataUrlToBlobUrl(url);
    window.open(blobUrl, "_blank", "noreferrer");
  }

  return (
    <div className="formCard adminEntityCard restaurantApprovalCard">
      <div className="adminEntityCard__title">
        {restaurant.name}
      </div>

      {/* Basic Information */}
      <div className="restaurantApprovalCard__section">
        <h3 className="restaurantApprovalCard__sectionTitle">Basic Information</h3>
        <div className="restaurantApprovalCard__grid">
          <div className="restaurantApprovalCard__field">
            <span className="restaurantApprovalCard__label">Cuisine:</span>
            <span className="restaurantApprovalCard__value">{restaurant.cuisine || "Not specified"}</span>
          </div>
          <div className="restaurantApprovalCard__field">
            <span className="restaurantApprovalCard__label">Price Range:</span>
            <span className="restaurantApprovalCard__value">{restaurant.price_range || "Not specified"}</span>
          </div>
          <div className="restaurantApprovalCard__field">
            <span className="restaurantApprovalCard__label">Phone:</span>
            <span className="restaurantApprovalCard__value">{restaurant.phone || "Not specified"}</span>
          </div>
          <div className="restaurantApprovalCard__field">
            <span className="restaurantApprovalCard__label">Address:</span>
            <span className="restaurantApprovalCard__value">{restaurant.address || "Not specified"}</span>
          </div>
        </div>
      </div>

      {/* Hours */}
      {(restaurant.opening_time || restaurant.closing_time) && (
        <div className="restaurantApprovalCard__section">
          <h3 className="restaurantApprovalCard__sectionTitle">Operating Hours</h3>
          <div className="restaurantApprovalCard__field">
            <span className="restaurantApprovalCard__label">Hours:</span>
            <span className="restaurantApprovalCard__value">
              {restaurant.opening_time || "Not set"} - {restaurant.closing_time || "Not set"}
            </span>
          </div>
        </div>
      )}

      {/* Description */}
      {restaurant.description && (
        <div className="restaurantApprovalCard__section">
          <h3 className="restaurantApprovalCard__sectionTitle">Description</h3>
          <p className="restaurantApprovalCard__description">{restaurant.description}</p>
        </div>
      )}

      {/* Dietary Support */}
      {restaurant.dietary_support && restaurant.dietary_support.length > 0 && (
        <div className="restaurantApprovalCard__section">
          <h3 className="restaurantApprovalCard__sectionTitle">Dietary Support</h3>
          <div className="restaurantApprovalCard__tags">
            {restaurant.dietary_support.map((diet, index) => (
              <span key={index} className="restaurantApprovalCard__tag">{diet}</span>
            ))}
          </div>
        </div>
      )}

      {/* Owner Information */}
      <div className="restaurantApprovalCard__section">
        <h3 className="restaurantApprovalCard__sectionTitle">Owner Information</h3>
        <div className="restaurantApprovalCard__field">
          <span className="restaurantApprovalCard__label">Name:</span>
          <span className="restaurantApprovalCard__value">{restaurant.owner_name || "Unknown"}</span>
        </div>
        <div className="restaurantApprovalCard__field">
          <span className="restaurantApprovalCard__label">Email:</span>
          <span className="restaurantApprovalCard__value">{restaurant.owner_email || "No email"}</span>
        </div>
      </div>

      {/* Documents */}
      <div className="restaurantApprovalCard__section">
        <h3 className="restaurantApprovalCard__sectionTitle">Required Documents</h3>

        <div className="restaurantApprovalCard__document">
          <span className="restaurantApprovalCard__label">Business License:</span>
          {restaurant.business_license_url ? (
            <button
              type="button"
              className="btn btn--link restaurantApprovalCard__documentLink"
              onClick={openBusinessLicense}
            >
              {restaurant.business_license_name || "View uploaded file"}
            </button>
          ) : (
            <span className="restaurantApprovalCard__missing">Not uploaded</span>
          )}
        </div>

        <div className="restaurantApprovalCard__document">
          <span className="restaurantApprovalCard__label">Health Certificate:</span>
          {restaurant.health_certificate_url ? (
            <button
              type="button"
              className="btn btn--link restaurantApprovalCard__documentLink"
              onClick={openHealthCertificate}
            >
              {restaurant.health_certificate_name || "View uploaded file"}
            </button>
          ) : (
            <span className="restaurantApprovalCard__missing">Not uploaded</span>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="restaurantApprovalCard__section restaurantApprovalCard__section--meta">
        <div className="restaurantApprovalCard__field">
          <span className="restaurantApprovalCard__label">Submitted:</span>
          <span className="restaurantApprovalCard__value">{new Date(restaurant.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="adminEntityCard__actions">
        <button
          className="btn btn--gold"
          type="button"
          onClick={onApprove}
          disabled={busy || !restaurant.business_license_url}
          title={!restaurant.business_license_url ? "Business license required for approval" : ""}
        >
          {busy ? "Saving..." : "✓ Approve Restaurant"}
        </button>
        <button
          className="btn btn--ghost"
          type="button"
          onClick={onReject}
          disabled={busy}
        >
          Reject
        </button>
      </div>
    </div>
  );
}

