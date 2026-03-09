import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { cancelReservation, getReservationsByUserId } from "../../services/reservationService.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

function toDateTimeValue(reservation) {
  const datePart = String(reservation.reservation_date || "").trim();
  const timePart = String(reservation.reservation_time || "00:00:00").slice(0, 8);

  const [hours, minutes, seconds] = String(timePart).split(":").map((value) => parseInt(value, 10));
  const normalizedHours = Number.isFinite(hours) ? hours : 0;
  const normalizedMinutes = Number.isFinite(minutes) ? minutes : 0;
  const normalizedSeconds = Number.isFinite(seconds) ? seconds : 0;

  const dateOnly = datePart.includes("T") ? datePart.slice(0, 10) : datePart;
  const separator = dateOnly.includes("-") ? "-" : dateOnly.includes("/") ? "/" : null;
  if (separator) {
    const rawParts = dateOnly.split(separator).map((value) => parseInt(value, 10));
    if (rawParts.length === 3 && rawParts.every((value) => Number.isFinite(value))) {
      let year;
      let month;
      let day;

      if (String(dateOnly.split(separator)[0]).length === 4) {
        year = rawParts[0];
        month = rawParts[1];
        day = rawParts[2];
      } else if (rawParts[0] > 12) {
        day = rawParts[0];
        month = rawParts[1];
        year = rawParts[2];
      } else {
        month = rawParts[0];
        day = rawParts[1];
        year = rawParts[2];
      }

      return new Date(year, month - 1, day, normalizedHours, normalizedMinutes, normalizedSeconds);
    }
  }

  const fallback = new Date(`${datePart} ${timePart}`);
  if (!Number.isNaN(fallback.getTime())) return fallback;

  return null;
}

function formatReservationDate(reservation) {
  const date = toDateTimeValue(reservation);
  if (!date || Number.isNaN(date.getTime())) return String(reservation?.reservation_date || "");
  return date.toLocaleDateString();
}

function formatReservationTime(reservation) {
  const date = toDateTimeValue(reservation);
  if (!date || Number.isNaN(date.getTime())) return String(reservation?.reservation_time || "").slice(0, 5);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function UserReservations() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cancellingId, setCancellingId] = useState(null);
  const [confirmReservation, setConfirmReservation] = useState(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    if (!user?.id) return;

    setLoading(true);
    setError("");
    getReservationsByUserId(user.id)
      .then((data) => setReservations(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || "Failed to load reservations"))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockNow(Date.now());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const { upcoming, past } = useMemo(() => {
    const now = new Date(clockNow);
    const grouped = { upcoming: [], past: [] };

    reservations.forEach((reservation) => {
      const dateTime = toDateTimeValue(reservation);
      const hasValidDateTime = dateTime instanceof Date && !Number.isNaN(dateTime.getTime());
      const hasPassed = hasValidDateTime ? dateTime < now : false;
      const isActive = reservation.status === "confirmed";

      if (isActive && !hasPassed) {
        grouped.upcoming.push(reservation);
      } else if (hasPassed) {
        grouped.past.push(reservation);
      }
    });

    grouped.upcoming.sort((a, b) => toDateTimeValue(a) - toDateTimeValue(b));
    grouped.past.sort((a, b) => toDateTimeValue(b) - toDateTimeValue(a));
    return grouped;
  }, [reservations, clockNow]);

  async function onCancelReservation(reservationId) {
    setMessage("");
    setError("");
    setCancellingId(reservationId);
    try {
      await cancelReservation(reservationId);
      setReservations((prev) => prev.filter((reservation) => reservation.id !== reservationId));
      window.dispatchEvent(
        new CustomEvent("ds:reservation-changed", {
          detail: {
            reservationId,
            restaurantId: confirmReservation?.restaurant_id ?? null,
            date: confirmReservation?.reservation_date ?? null,
            time: confirmReservation?.reservation_time ?? null,
            action: "cancelled",
          },
        })
      );
      setConfirmReservation(null);
      setMessage("Reservation cancelled.");
    } catch (err) {
      setError(err.message || "Failed to cancel reservation.");
    } finally {
      setCancellingId(null);
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
    <div className="userReservationsPage">
      <h1 className="placeholderPage__title">Reservations</h1>
      {message && <div className="inlineToast">{message}</div>}
      {error && <div className="fieldError">{error}</div>}

      <section className="reservationSection">
        <h2 className="reservationSection__title">Upcoming Reservations</h2>
        {upcoming.length === 0 ? (
          <p className="placeholderPage__text">No upcoming reservations.</p>
        ) : (
          <div className="reservationList">
            {upcoming.map((reservation) => (
              <article className="reservationCard" key={reservation.id}>
                <div className="reservationCard__top">
                  <div className="reservationCard__name">{reservation.restaurant_name}</div>
                  <span className="statusBadge statusBadge--valid">Valid Date</span>
                </div>
                <div className="reservationCard__meta">
                  {formatReservationDate(reservation)} at {formatReservationTime(reservation)}
                </div>
                <div className="reservationCard__meta">
                  Party of {reservation.party_size} - Confirmation {reservation.confirmation_id}
                </div>
                <div className="reservationCard__actions">
                  <button
                    className="btn btn--ghost"
                    type="button"
                    disabled={cancellingId === reservation.id}
                    onClick={() => setConfirmReservation(reservation)}
                  >
                    {cancellingId === reservation.id ? "Cancelling..." : "Cancel Reservation"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="reservationSection">
        <h2 className="reservationSection__title">Past Reservations</h2>
        {past.length === 0 ? (
          <p className="placeholderPage__text">No past reservations yet.</p>
        ) : (
          <div className="reservationList">
            {past.map((reservation) => (
              <article className="reservationCard" key={reservation.id}>
                <div className="reservationCard__top">
                  <div className="reservationCard__name">{reservation.restaurant_name}</div>
                  <span className="statusBadge statusBadge--invalid">Invalid Date</span>
                </div>
                <div className="reservationCard__meta">
                  {formatReservationDate(reservation)} at {formatReservationTime(reservation)}
                </div>
                <div className="reservationCard__meta">
                  Party of {reservation.party_size} - Confirmation {reservation.confirmation_id}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!confirmReservation}
        title="Cancel this reservation?"
        message={
          confirmReservation
            ? `${confirmReservation.restaurant_name} on ${new Date(`${confirmReservation.reservation_date}T00:00:00`).toLocaleDateString()} at ${String(confirmReservation.reservation_time).slice(0, 5)}.`
            : ""
        }
        confirmLabel="Cancel Reservation"
        cancelLabel="Keep Reservation"
        busy={cancellingId === confirmReservation?.id}
        busyLabel="Cancelling..."
        onConfirm={() => {
          if (!confirmReservation) return;
          onCancelReservation(confirmReservation.id);
        }}
        onCancel={() => {
          if (cancellingId === confirmReservation?.id) return;
          setConfirmReservation(null);
        }}
      />
    </div>
  );
}
