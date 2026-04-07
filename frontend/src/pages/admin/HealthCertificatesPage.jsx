import React, { useEffect, useState } from "react";
import {
  getRestaurantsWithHealthCertificates,
  verifyRestaurant,
  unverifyRestaurant,
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

export default function HealthCertificatesPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getRestaurantsWithHealthCertificates();
        if (!cancelled) setRestaurants(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load restaurants.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleVerify(restaurant) {
    setSuccess(""); setError("");
    setBusyId(restaurant.id);
    try {
      await verifyRestaurant(restaurant.id);
      setRestaurants((prev) =>
        prev.map((r) => r.id === restaurant.id ? { ...r, certificate_verified: true } : r)
      );
      setSuccess(`"${restaurant.name}" is now verified.`);
    } catch (err) {
      setError(err.message || "Failed to verify restaurant.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnverify(restaurant) {
    setSuccess(""); setError("");
    setBusyId(restaurant.id);
    try {
      await unverifyRestaurant(restaurant.id);
      setRestaurants((prev) =>
        prev.map((r) => r.id === restaurant.id ? { ...r, certificate_verified: false } : r)
      );
      setSuccess(`"${restaurant.name}" verification removed.`);
    } catch (err) {
      setError(err.message || "Failed to unverify restaurant.");
    } finally {
      setBusyId(null);
    }
  }

  const pending = restaurants.filter((r) => !r.certificate_verified);
  const verified = restaurants.filter((r) => r.certificate_verified);

  return (
    <div className="adminPage">
      <h1 className="ownerProfile__title">Health Certificate Verification</h1>
      <p className="adminPage__subtitle">
        Restaurants below have uploaded a health certificate. Grant or remove the verified badge.
      </p>

      {success && <div className="inlineToast">{success}</div>}
      {error && <div className="fieldError">{error}</div>}

      {loading ? (
        <p className="placeholderPage__text">Loading...</p>
      ) : restaurants.length === 0 ? (
        <p className="placeholderPage__text">No restaurants have uploaded a health certificate yet.</p>
      ) : (
        <>
          {pending.length > 0 && (
            <>
              <h2 className="adminPage__sectionTitle">Awaiting Verification ({pending.length})</h2>
              <div className="adminCardList">
                {pending.map((r) => (
                  <RestaurantCertCard
                    key={r.id}
                    restaurant={r}
                    busy={busyId === r.id}
                    onVerify={() => handleVerify(r)}
                    onUnverify={() => handleUnverify(r)}
                  />
                ))}
              </div>
            </>
          )}

          {verified.length > 0 && (
            <>
              <h2 className="adminPage__sectionTitle" style={{ marginTop: 32 }}>
                Already Verified ({verified.length})
              </h2>
              <div className="adminCardList">
                {verified.map((r) => (
                  <RestaurantCertCard
                    key={r.id}
                    restaurant={r}
                    busy={busyId === r.id}
                    onVerify={() => handleVerify(r)}
                    onUnverify={() => handleUnverify(r)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function RestaurantCertCard({ restaurant, busy, onVerify, onUnverify }) {
  function openCertificate() {
    const url = restaurant.health_certificate_url;
    if (!url) return;
    const blobUrl = dataUrlToBlobUrl(url);
    window.open(blobUrl, "_blank", "noreferrer");
  }

  return (
    <div className="formCard adminEntityCard">
      <div className="adminEntityCard__title">
        {restaurant.name}
        {restaurant.certificate_verified && (
          <span className="verifiedBadge" title="Verified Restaurant">
            <svg className="verifiedBadge__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Verified">
              <circle cx="12" cy="12" r="12" fill="#1877F2"/>
              <path d="M7 12.5l3.5 3.5 6.5-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        )}
      </div>
      <div className="adminEntityCard__meta">
        {restaurant.cuisine || "Cuisine not set"} • {restaurant.address || "Address not set"}
      </div>
      <div className="adminEntityCard__meta">
        Owner: {restaurant.owner_name || "Unknown"} ({restaurant.owner_email || "No email"})
      </div>
      <div className="adminEntityCard__meta">
        Certificate:{" "}
        {restaurant.health_certificate_url ? (
          <button
            type="button"
            className="btn btn--link"
            onClick={openCertificate}
          >
            {restaurant.health_certificate_name || "View uploaded file"}
          </button>
        ) : (
          <span style={{ color: "rgba(255,255,255,0.4)" }}>No file uploaded</span>
        )}
      </div>
      <div className="adminEntityCard__meta">
        Uploaded: {new Date(restaurant.updated_at).toLocaleDateString()}
      </div>

      <div className="adminEntityCard__actions">
        {restaurant.certificate_verified ? (
          <button
            className="btn btn--ghost"
            type="button"
            onClick={onUnverify}
            disabled={busy}
          >
            {busy ? "Saving..." : "Remove Verification"}
          </button>
        ) : (
          <button
            className="btn btn--gold"
            type="button"
            onClick={onVerify}
            disabled={busy}
          >
            {busy ? "Saving..." : "✓ Grant Verified Badge"}
          </button>
        )}
      </div>
    </div>
  );
}
