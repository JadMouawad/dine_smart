import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthContext.jsx";
import { cancelReservation, getReservationsByUserId } from "../../services/reservationService.js";
import { getUserEventReservations, cancelUserEventReservation } from "../../services/eventService.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import EditReservationModal from "../../components/EditReservationModal.jsx";
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
  const [eventReservations, setEventReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState(null);
  const [confirmReservation, setConfirmReservation] = useState(null);
  const [editingReservation, setEditingReservation] = useState(null);
  const [confirmEventReservation, setConfirmEventReservation] = useState(null);
  const [cancellingEventId, setCancellingEventId] = useState(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    if (!user?.id) return;

    setLoading(true);
    setError("");
    Promise.all([getReservationsByUserId(user.id), getUserEventReservations()])
      .then(([tableData, eventData]) => {
        setReservations(Array.isArray(tableData) ? tableData : []);
        const filteredEvents = Array.isArray(eventData)
          ? eventData.filter((item) => String(item.status || "").toLowerCase() !== "cancelled")
          : [];
        setEventReservations(filteredEvents);
      })
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

  function normalizeDatePart(value) {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const raw = String(value).trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
  }

  function normalizeTimePart(value, fallback) {
    if (!value) return fallback;
    if (value instanceof Date) return value.toISOString().slice(11, 19);
    const raw = String(value).trim();
    if (!raw) return fallback;
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) return raw.length === 5 ? `${raw}:00` : raw;
    return fallback;
  }

  function toEventDateTime(reservation, useEnd = false) {
    const fallbackDate = reservation.event_date || reservation.start_date || reservation.end_date || "";
    const datePart = normalizeDatePart(
      useEnd ? (reservation.end_date || reservation.start_date || reservation.event_date || "") : (reservation.start_date || reservation.event_date || reservation.end_date || "")
    ) || normalizeDatePart(fallbackDate);
    if (!datePart) return null;
    const timePartRaw = useEnd ? reservation.end_time : reservation.start_time;
    const fallbackTime = useEnd ? "23:59:59" : "00:00:00";
    const timePart = normalizeTimePart(timePartRaw, fallbackTime);
    const parsed = new Date(`${datePart}T${timePart}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatEventDateTime(reservation) {
    const start = toEventDateTime(reservation, false);
    if (!start) return "Date/time unavailable";
    return `${start.toLocaleDateString()} at ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  const { upcomingEvents, pastEvents } = useMemo(() => {
    const now = new Date(clockNow);
    const grouped = { upcomingEvents: [], pastEvents: [] };
    eventReservations.forEach((reservation) => {
      const end = toEventDateTime(reservation, true);
      const isPast = end ? end < now : false;
      if (isPast) grouped.pastEvents.push(reservation);
      else grouped.upcomingEvents.push(reservation);
    });
    grouped.upcomingEvents.sort((a, b) => (toEventDateTime(a, false)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (toEventDateTime(b, false)?.getTime() ?? Number.MAX_SAFE_INTEGER));
    grouped.pastEvents.sort((a, b) => (toEventDateTime(b, true)?.getTime() ?? 0) - (toEventDateTime(a, true)?.getTime() ?? 0));
    return grouped;
  }, [eventReservations, clockNow]);

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

  function onReservationUpdated(updatedReservation) {
    setReservations((prev) =>
      prev.map((r) => (r.id === updatedReservation.id ? { ...r, ...updatedReservation } : r))
    );
  }

  async function onCancelEventReservation(eventId) {
    setError("");
    setCancellingEventId(eventId);
    try {
      await cancelUserEventReservation(eventId);
      setEventReservations((prev) => prev.filter((reservation) => reservation.event_id !== eventId));
      setConfirmEventReservation(null);
      toast.success("Event reservation cancelled.");
    } catch (err) {
      setError(err.message || "We couldn't cancel that event reservation. Please try again.");
    } finally {
      setCancellingEventId(null);
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
                      className="btn btn--secondary"
                      type="button"
                      onClick={() => setEditingReservation(reservation)}
                    >
                      Edit reservation
                    </button>
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

      <section className="reservationSection">
        <h2 className="reservationSection__title">Event Reservations</h2>
        {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
          <EmptyState
            title="No event reservations"
            message="Event bookings will appear here once you reserve an event."
          />
        ) : (
          <>
            {upcomingEvents.length > 0 && (
              <div className="reservationList">
                {upcomingEvents.map((reservation) => (
                  <article className="reservationCard" key={`event-up-${reservation.id}`}>
                    <div className="reservationCard__top">
                      <div className="reservationCard__name">{reservation.event_title || "Event"}</div>
                      <span className="statusBadge statusBadge--confirmed">Event</span>
                    </div>
                    <div className="reservationCard__meta">
                      Restaurant: {reservation.restaurant_name || "N/A"}
                    </div>
                    <div className="reservationCard__meta">
                      {formatEventDateTime(reservation)}
                    </div>
                    <div className="reservationCard__meta">
                      Attendees: {reservation.attendees_count || 1}
                    </div>
                    <div className="reservationCard__actions">
                      <button
                        className="btn btn--ghost"
                        type="button"
                        disabled={cancellingEventId === reservation.event_id}
                        onClick={() => setConfirmEventReservation(reservation)}
                      >
                        {cancellingEventId === reservation.event_id ? "Cancelling..." : "Cancel Reservation"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {pastEvents.length > 0 && (
              <div className="reservationList">
                {pastEvents.map((reservation) => (
                  <article className="reservationCard" key={`event-past-${reservation.id}`}>
                    <div className="reservationCard__top">
                      <div className="reservationCard__name">{reservation.event_title || "Event"}</div>
                      <span className="statusBadge statusBadge--completed">Past</span>
                    </div>
                    <div className="reservationCard__meta">
                      Restaurant: {reservation.restaurant_name || "N/A"}
                    </div>
                    <div className="reservationCard__meta">
                      {formatEventDateTime(reservation)}
                    </div>
                    <div className="reservationCard__meta">
                      Attendees: {reservation.attendees_count || 1}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {editingReservation && (
        <EditReservationModal
          reservation={editingReservation}
          onClose={() => setEditingReservation(null)}
          onUpdated={onReservationUpdated}
        />
      )}

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

      <ConfirmDialog
        open={!!confirmEventReservation}
        title="Are you sure you want to cancel this reservation?"
        message={
          confirmEventReservation
            ? `${confirmEventReservation.event_title || "Event"} • ${formatEventDateTime(confirmEventReservation)}`
            : ""
        }
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        busy={cancellingEventId === confirmEventReservation?.event_id}
        busyLabel="Cancelling..."
        onConfirm={() => {
          if (!confirmEventReservation) return;
          onCancelEventReservation(confirmEventReservation.event_id);
        }}
        onCancel={() => {
          if (cancellingEventId === confirmEventReservation?.event_id) return;
          setConfirmEventReservation(null);
        }}
      />
    </div>
  );
}