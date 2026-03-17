import React, { useEffect, useMemo, useState } from "react";
import { getOwnerReservations, updateOwnerReservationStatus } from "../../services/reservationService";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

function toDateTimeValue(reservation) {
  const datePart = String(reservation.reservation_date || "").trim();
  const timePart = String(reservation.reservation_time || "00:00:00").slice(0, 8);
  const parsed = new Date(`${datePart}T${timePart}`);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
}

function formatDateTime(reservation) {
  const date = toDateTimeValue(reservation);
  if (!date) return `${reservation.reservation_date} ${String(reservation.reservation_time || "").slice(0, 5)}`;
  return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function toStatusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (["pending", "accepted", "confirmed", "cancelled", "no-show", "completed", "rejected"].includes(normalized)) {
    return `statusBadge statusBadge--${normalized}`;
  }
  return "statusBadge";
}

function formatOwnerReservationStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "confirmed") return "accepted";
  if (normalized === "accepted") return "accepted";
  if (normalized === "cancelled") return "cancelled";
  return normalized || "unknown";
}

export default function OwnerReservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [confirmRejectReservation, setConfirmRejectReservation] = useState(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  async function loadReservations() {
    setError("");
    try {
      const data = await getOwnerReservations();
      setReservations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load reservations.");
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReservations();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadReservations();
    }, 20000);

    function onReservationChanged() {
      loadReservations();
    }

    window.addEventListener("ds:reservation-changed", onReservationChanged);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("ds:reservation-changed", onReservationChanged);
    };
  }, []);

  const { upcomingReservations, pastReservations } = useMemo(() => {
    const now = new Date(clockNow);
    const upcoming = [];
    const past = [];

    reservations.forEach((reservation) => {
      const normalizedStatus = String(reservation.status || "").trim().toLowerCase();
      const reservationDateTime = toDateTimeValue(reservation);
      const isExpired = reservationDateTime ? reservationDateTime < now : true;
      const isCancelled = normalizedStatus === "cancelled";
      const isAccepted = normalizedStatus === "accepted" || normalizedStatus === "confirmed";
      const isPending = normalizedStatus === "pending";

      if (isCancelled || isExpired || (!isAccepted && !isPending)) {
        past.push(reservation);
        return;
      }

      upcoming.push(reservation);
    });

    upcoming.sort((a, b) => (toDateTimeValue(a)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (toDateTimeValue(b)?.getTime() ?? Number.MAX_SAFE_INTEGER));
    past.sort((a, b) => (toDateTimeValue(b)?.getTime() ?? 0) - (toDateTimeValue(a)?.getTime() ?? 0));

    return { upcomingReservations: upcoming, pastReservations: past };
  }, [reservations, clockNow]);

  async function handleAction(reservationId, action) {
    setUpdatingId(reservationId);
    setError("");
    setSuccess("");
    try {
      const updated = await updateOwnerReservationStatus(reservationId, action);
      setReservations((prev) =>
        prev.map((reservation) =>
          reservation.id === reservationId
            ? { ...reservation, ...updated }
            : reservation
        )
      );
      setSuccess(action === "accept" ? "Reservation accepted." : "Reservation rejected.");
      window.dispatchEvent(
        new CustomEvent("ds:reservation-changed", {
          detail: {
            reservationId,
            restaurantId: updated.restaurant_id,
            date: updated.reservation_date,
            time: updated.reservation_time,
            action: action === "accept" ? "accepted" : "rejected",
          },
        })
      );
    } catch (err) {
      setError(err.message || "Failed to update reservation status.");
    } finally {
      setUpdatingId(null);
      setConfirmRejectReservation(null);
    }
  }

  if (loading) {
    return (
      <div className="placeholderPage">
        <h1 className="placeholderPage__title">Reservations</h1>
        <p className="placeholderPage__text">Loading reservations...</p>
      </div>
    );
  }

  return (
    <div className="ownerTableConfigPage">
      <h1 className="ownerProfile__title">Reservations</h1>
      {success && <div className="inlineToast">{success}</div>}
      {error && <div className="fieldError">{error}</div>}

      <section className="reservationSection">
        <h2 className="reservationSection__title">Upcoming Reservations</h2>
        {upcomingReservations.length === 0 ? (
          <div className="menuSectionEmpty">No upcoming reservations.</div>
        ) : (
          <div className="reservationList">
            {upcomingReservations.map((reservation) => {
            const normalizedStatus = String(reservation.status || "").toLowerCase();
            const canTakeAction = normalizedStatus === "pending";
            return (
              <article className="reservationCard" key={reservation.id}>
                <div className="reservationCard__top">
                  <div className="reservationCard__name">{reservation.customer_name || "Guest"}</div>
                  <span className={toStatusClass(reservation.status)}>{formatOwnerReservationStatus(reservation.status)}</span>
                </div>
                <div className="reservationCard__meta">
                  Restaurant: {reservation.restaurant_name || "N/A"}
                </div>
                <div className="reservationCard__meta">
                  {formatDateTime(reservation)}
                </div>
                <div className="reservationCard__meta">
                  Seats: {reservation.party_size} | Confirmation: {reservation.confirmation_id}
                </div>
                <div className="reservationCard__meta">
                  Customer email: {reservation.customer_email || "N/A"}
                </div>
                {canTakeAction && (
                  <div className="reservationCard__actions ownerReservationActions">
                    <button
                      className="btn btn--gold"
                      type="button"
                      disabled={updatingId === reservation.id}
                      onClick={() => handleAction(reservation.id, "accept")}
                    >
                      {updatingId === reservation.id ? "Updating..." : "Accept"}
                    </button>
                    <button
                      className="btn btn--ghost"
                      type="button"
                      disabled={updatingId === reservation.id}
                      onClick={() => setConfirmRejectReservation(reservation)}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </article>
            );
            })}
          </div>
        )}
      </section>

      <section className="reservationSection">
        <h2 className="reservationSection__title">Past Reservations</h2>
        {pastReservations.length === 0 ? (
          <div className="menuSectionEmpty">No past reservations yet.</div>
        ) : (
          <div className="reservationList">
            {pastReservations.map((reservation) => (
              <article className="reservationCard" key={reservation.id}>
                <div className="reservationCard__top">
                  <div className="reservationCard__name">{reservation.customer_name || "Guest"}</div>
                  <span className={toStatusClass(reservation.status)}>{formatOwnerReservationStatus(reservation.status)}</span>
                </div>
                <div className="reservationCard__meta">
                  Restaurant: {reservation.restaurant_name || "N/A"}
                </div>
                <div className="reservationCard__meta">
                  {formatDateTime(reservation)}
                </div>
                <div className="reservationCard__meta">
                  Seats: {reservation.party_size} | Confirmation: {reservation.confirmation_id}
                </div>
                <div className="reservationCard__meta">
                  Customer email: {reservation.customer_email || "N/A"}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!confirmRejectReservation}
        title="Reject this reservation?"
        message={
          confirmRejectReservation
            ? `Are you sure you want to reject ${confirmRejectReservation.customer_name || "this guest"}'s reservation for ${formatDateTime(confirmRejectReservation)}?`
            : ""
        }
        confirmLabel="Reject Reservation"
        cancelLabel="Keep Reservation"
        busy={updatingId === confirmRejectReservation?.id}
        busyLabel="Updating..."
        onConfirm={() => {
          if (!confirmRejectReservation) return;
          handleAction(confirmRejectReservation.id, "reject");
        }}
        onCancel={() => setConfirmRejectReservation(null)}
      />
    </div>
  );
}
