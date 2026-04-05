import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthContext.jsx";
import { cancelReservation, getReservationsByUserId } from "../../services/reservationService.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { formatReservationDate, formatReservationTime, toReservationSortTimestamp, toReservationDateTime } from "../../utils/dateUtils";

function toStatusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (["pending", "accepted", "confirmed", "cancelled", "no-show", "completed", "rejected"].includes(normalized)) {
    return `statusBadge statusBadge--${normalized}`;
  }
  return "statusBadge";
}

function formatStatusLabel(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  if (normalized === "accepted" || normalized === "confirmed") return "Accepted";
  if (normalized === "no-show") return "No-show";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export default function UserReservations() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState(null);
  const [confirmReservation, setConfirmReservation] = useState(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    if (!user?.id) return;

    setLoading(true);
    setError("");
    getReservationsByUserId(user.id)
      .then((data) => setReservations(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || "We couldn't load your reservations. Please refresh and try again."))
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
      const dateTime = toReservationDateTime(reservation);
      const hasValidDateTime = dateTime instanceof Date && !Number.isNaN(dateTime.getTime());
      const hasPassed = hasValidDateTime ? dateTime < now : false;
      const normalizedStatus = String(reservation.status || "").toLowerCase();
      const isAccepted = normalizedStatus === "accepted" || normalizedStatus === "confirmed";
      const isPending = normalizedStatus === "pending";
      const isTerminalStatus = ["cancelled", "completed", "no-show", "rejected"].includes(normalizedStatus);

      if ((isAccepted || isPending) && !hasPassed) {
        grouped.upcoming.push(reservation);
      } else if (isTerminalStatus || hasPassed || !hasValidDateTime) {
        grouped.past.push(reservation);
      } else {
        grouped.upcoming.push(reservation);
      }
    });

    grouped.upcoming.sort((a, b) => toReservationSortTimestamp(a, Number.MAX_SAFE_INTEGER) - toReservationSortTimestamp(b, Number.MAX_SAFE_INTEGER));
    grouped.past.sort((a, b) => toReservationSortTimestamp(b, 0) - toReservationSortTimestamp(a, 0));
    return grouped;
  }, [reservations, clockNow]);

  async function onCancelReservation(reservationId) {
    setError("");
    setCancellingId(reservationId);
    try {
      const cancelled = await cancelReservation(reservationId);
      setReservations((prev) =>
        prev.map((reservation) =>
          reservation.id === reservationId
            ? { ...reservation, ...cancelled, status: "cancelled" }
            : reservation
        )
      );
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
      toast.success("Reservation cancelled. The restaurant has been updated.");
    } catch (err) {
      setError(err.message || "We couldn't cancel that reservation. Please try again.");
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
      {error && <div className="fieldError">{error}</div>}

      <section className="reservationSection">
        <h2 className="reservationSection__title">Upcoming Reservations</h2>
        {upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming reservations"
            message="When you book a table, your upcoming reservations will appear here."
          />
        ) : (
          <div className="reservationList">
            {upcoming.map((reservation) => (
              <article className="reservationCard" key={reservation.id}>
                <div className="reservationCard__top">
                  <div className="reservationCard__name">{reservation.restaurant_name}</div>
                  <span className={toStatusClass(reservation.status)}>{formatStatusLabel(reservation.status)}</span>
                </div>
                <div className="reservationCard__meta">
                  {formatReservationDate(reservation)} at {formatReservationTime(reservation)}
                </div>
                <div className="reservationCard__meta">
                  Party of {reservation.party_size} - Confirmation {reservation.confirmation_id}
                </div>
                {["pending", "accepted", "confirmed"].includes(String(reservation.status || "").toLowerCase()) && (
                  <div className="reservationCard__actions">
                    <button
                      className="btn btn--ghost"
                      type="button"
                      disabled={cancellingId === reservation.id}
                      onClick={() => setConfirmReservation(reservation)}
                    >
                      {cancellingId === reservation.id ? "Cancelling..." : "Cancel reservation"}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="reservationSection">
        <h2 className="reservationSection__title">Past Reservations</h2>
        {past.length === 0 ? (
          <EmptyState
            title="No past reservations"
            message="Your past reservations will appear here once you have visited or cancelled a booking."
          />
        ) : (
          <div className="reservationList">
            {past.map((reservation) => (
              <article className="reservationCard" key={reservation.id}>
                <div className="reservationCard__top">
                  <div className="reservationCard__name">{reservation.restaurant_name}</div>
                  <span className={toStatusClass(reservation.status)}>{formatStatusLabel(reservation.status)}</span>
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
        open={Boolean(confirmReservation)}
        title="Cancel reservation?"
        message={
          confirmReservation
            ? `Are you sure you want to cancel your reservation at ${confirmReservation.restaurant_name} on ${formatReservationDate(confirmReservation)} at ${formatReservationTime(confirmReservation)}?`
            : ""
        }
        confirmLabel={cancellingId ? "Cancelling..." : "Yes, cancel it"}
        cancelLabel="Keep reservation"
        destructive
        loading={Boolean(cancellingId)}
        onConfirm={() => confirmReservation && onCancelReservation(confirmReservation.id)}
        onCancel={() => {
          if (!cancellingId) setConfirmReservation(null);
        }}
      />
    </div>
  );
}