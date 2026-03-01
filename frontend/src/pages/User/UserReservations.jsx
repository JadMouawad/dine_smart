import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { cancelReservation, getReservationsByUserId } from "../../services/reservationService.js";

function toDateTimeValue(reservation) {
  const datePart = reservation.reservation_date;
  const timePart = String(reservation.reservation_time || "00:00:00").slice(0, 8);
  return new Date(`${datePart}T${timePart}`);
}

export default function UserReservations() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    if (!user?.id) return;

    setLoading(true);
    setError("");
    getReservationsByUserId(user.id)
      .then((data) => setReservations(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || "Failed to load reservations"))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const grouped = { upcoming: [], past: [] };

    reservations.forEach((reservation) => {
      const dateTime = toDateTimeValue(reservation);
      const isUpcoming = reservation.status === "confirmed" && dateTime >= now;
      if (isUpcoming) grouped.upcoming.push(reservation);
      else grouped.past.push(reservation);
    });

    return grouped;
  }, [reservations]);

  async function onCancelReservation(reservationId) {
    setMessage("");
    setError("");
    setCancellingId(reservationId);
    try {
      await cancelReservation(reservationId);
      setReservations((prev) => prev.filter((reservation) => reservation.id !== reservationId));
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
        <h2 className="reservationSection__title">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="placeholderPage__text">No upcoming reservations.</p>
        ) : (
          <div className="reservationList">
            {upcoming.map((reservation) => (
              <article className="reservationCard" key={reservation.id}>
                <div className="reservationCard__top">
                  <div className="reservationCard__name">{reservation.restaurant_name}</div>
                  <span className="statusBadge statusBadge--confirmed">{reservation.status}</span>
                </div>
                <div className="reservationCard__meta">
                  {new Date(`${reservation.reservation_date}T00:00:00`).toLocaleDateString()} at {String(reservation.reservation_time).slice(0, 5)}
                </div>
                <div className="reservationCard__meta">
                  Party of {reservation.party_size} • Confirmation {reservation.confirmation_id}
                </div>
                <div className="reservationCard__actions">
                  <button
                    className="btn btn--ghost"
                    type="button"
                    disabled={cancellingId === reservation.id}
                    onClick={() => onCancelReservation(reservation.id)}
                  >
                    {cancellingId === reservation.id ? "Cancelling..." : "Cancel"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="reservationSection">
        <h2 className="reservationSection__title">Past</h2>
        {past.length === 0 ? (
          <p className="placeholderPage__text">No past reservations yet.</p>
        ) : (
          <div className="reservationList">
            {past.map((reservation) => (
              <article className="reservationCard" key={reservation.id}>
                <div className="reservationCard__top">
                  <div className="reservationCard__name">{reservation.restaurant_name}</div>
                  <span className={`statusBadge statusBadge--${reservation.status}`}>{reservation.status}</span>
                </div>
                <div className="reservationCard__meta">
                  {new Date(`${reservation.reservation_date}T00:00:00`).toLocaleDateString()} at {String(reservation.reservation_time).slice(0, 5)}
                </div>
                <div className="reservationCard__meta">
                  Party of {reservation.party_size} • Confirmation {reservation.confirmation_id}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

