import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getMyRestaurant, getOwnerRestaurantTableConfig, getOwnerEventReservations, deleteOwnerEventReservation } from "../../services/restaurantService";
import {
  getOwnerReservations,
  updateOwnerReservationStatus,
  markOwnerReservationNoShow,
  deleteOwnerReservation,
  getOwnerSlotAdjustment,
  saveOwnerSlotAdjustment,
  getReservationAvailability,
} from "../../services/reservationService";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import EmptyState from "../../components/EmptyState.jsx";

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

function pad2(value) {
  return String(value).padStart(2, "0");
}

function getTodayDateValue() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function getRoundedTimeValue() {
  const now = new Date();
  const minutes = Math.ceil(now.getMinutes() / 30) * 30;
  if (minutes >= 60) {
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
  } else {
    now.setMinutes(minutes);
  }
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

export default function OwnerReservations() {
  const [restaurant, setRestaurant] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [eventReservations, setEventReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [confirmRejectReservation, setConfirmRejectReservation] = useState(null);
  const [confirmDeleteReservation, setConfirmDeleteReservation] = useState(null);
  const [deletingReservationId, setDeletingReservationId] = useState(null);
  const [confirmDeleteEventReservation, setConfirmDeleteEventReservation] = useState(null);
  const [deletingEventReservationId, setDeletingEventReservationId] = useState(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [adjustmentDate, setAdjustmentDate] = useState(getTodayDateValue());
  const [adjustmentTime, setAdjustmentTime] = useState(getRoundedTimeValue());
  const [adjustmentPreference, setAdjustmentPreference] = useState("any");
  const [adjustmentValue, setAdjustmentValue] = useState("0");
  const [adjustmentLoading, setAdjustmentLoading] = useState(false);
  const [adjustmentFetching, setAdjustmentFetching] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState("");
  const [baseCapacity, setBaseCapacity] = useState(null);
  const [slotAvailability, setSlotAvailability] = useState(null);

  async function loadReservations() {
    setError("");
    try {
      const data = await getOwnerReservations();
      setReservations(Array.isArray(data) ? data : []);
      const eventData = await getOwnerEventReservations();
      setEventReservations(Array.isArray(eventData) ? eventData : []);
    } catch (err) {
      setError(err.message || "We couldn't load reservations. Please refresh and try again.");
      setReservations([]);
      setEventReservations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReservations();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMyRestaurant()
      .then((data) => {
        if (!cancelled) {
          setRestaurant(data);
          if (data?.id) {
            getOwnerRestaurantTableConfig(data.id)
              .then((config) => {
                if (!cancelled && config) {
                  const t2 = parseInt(config.table_2_person, 10) || 0;
                  const t4 = parseInt(config.table_4_person, 10) || 0;
                  const t6 = parseInt(config.table_6_person, 10) || 0;
                  const tableBased = (t2 * 2) + (t4 * 4) + (t6 * 6);
                  setBaseCapacity(tableBased > 0 ? tableBased : (parseInt(config.total_capacity, 10) || null));
                }
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {
        if (!cancelled) setRestaurant(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!restaurant?.id || !adjustmentDate || !adjustmentTime) return;
    let cancelled = false;
    setAdjustmentFetching(true);
    setAdjustmentError("");

    getOwnerSlotAdjustment({
      restaurantId: restaurant.id,
      date: adjustmentDate,
      time: adjustmentTime,
      seatingPreference: adjustmentPreference,
    })
      .then((data) => {
        if (cancelled) return;
        setAdjustmentValue(String(data?.adjustment ?? 0));
      })
      .catch((err) => {
        if (cancelled) return;
        const rawMessage = String(err?.message || "").toLowerCase();
        const isInternalRuntimeMessage =
          rawMessage.includes("not a function") ||
          rawMessage.includes("reservationservice.") ||
          rawMessage.includes("undefined");
        setAdjustmentError(
          isInternalRuntimeMessage
            ? "Couldn't load seat adjustments for this slot."
            : (err.message || "Couldn't load seat adjustments for this slot.")
        );
      })
      .finally(() => {
        if (!cancelled) setAdjustmentFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [restaurant?.id, adjustmentDate, adjustmentTime, adjustmentPreference]);

  useEffect(() => {
    if (!restaurant?.id || !adjustmentDate || !adjustmentTime) return;
    let cancelled = false;
    setSlotAvailability(null);

    getReservationAvailability({
      restaurantId: restaurant.id,
      date: adjustmentDate,
      time: adjustmentTime,
      seatingPreference: adjustmentPreference !== "any" ? adjustmentPreference : undefined,
    })
      .then((data) => {
        if (!cancelled) setSlotAvailability(data);
      })
      .catch(() => {
        if (!cancelled) setSlotAvailability(null);
      });

    return () => {
      cancelled = true;
    };
  }, [restaurant?.id, adjustmentDate, adjustmentTime, adjustmentPreference]);

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

  function toEventDateTime(reservation, useEnd = false) {
    const datePart = String(useEnd ? (reservation.end_date || reservation.start_date || "") : (reservation.start_date || reservation.end_date || "")).trim();
    const timePartRaw = useEnd ? reservation.end_time : reservation.start_time;
    const timePart = String(timePartRaw || (useEnd ? "23:59:59" : "00:00:00")).slice(0, 8);
    const parsed = new Date(`${datePart}T${timePart}`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return null;
  }

  function formatEventDateTime(reservation) {
    const start = toEventDateTime(reservation, false);
    if (!start) return "Date/time unavailable";
    return `${start.toLocaleDateString()} at ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  const { upcomingEventReservations, pastEventReservations } = useMemo(() => {
    const now = new Date(clockNow);
    const upcoming = [];
    const past = [];
    eventReservations.forEach((reservation) => {
      const end = toEventDateTime(reservation, true);
      const isPast = end ? end < now : false;
      if (isPast) {
        past.push(reservation);
      } else {
        upcoming.push(reservation);
      }
    });
    upcoming.sort((a, b) => (toEventDateTime(a, false)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (toEventDateTime(b, false)?.getTime() ?? Number.MAX_SAFE_INTEGER));
    past.sort((a, b) => (toEventDateTime(b, true)?.getTime() ?? 0) - (toEventDateTime(a, true)?.getTime() ?? 0));
    return { upcomingEventReservations: upcoming, pastEventReservations: past };
  }, [eventReservations, clockNow]);

  async function handleDeleteEventReservation(reservationId) {
    setError("");
    setSuccess("");
    setDeletingEventReservationId(reservationId);
    try {
      await deleteOwnerEventReservation(reservationId);
      setEventReservations((prev) => prev.filter((item) => item.id !== reservationId));
      setSuccess("Event reservation deleted.");
      setConfirmDeleteEventReservation(null);
    } catch (err) {
      setError(err.message || "Failed to delete event reservation.");
    } finally {
      setDeletingEventReservationId(null);
    }
  }

  async function handleSaveAdjustment(event) {
    event.preventDefault();
    if (!restaurant?.id) return;

    const parsedAdjustment = parseInt(adjustmentValue, 10);
    if (Number.isNaN(parsedAdjustment)) {
      setAdjustmentError("Adjustment must be a valid number.");
      return;
    }

    // Prevent reducing below already-booked seats
    if (slotAvailability != null && parsedAdjustment < 0) {
      const total = slotAvailability.total_capacity ?? baseCapacity ?? 0;
      const booked = slotAvailability.booked_seats ?? 0;
      const available = Math.max(total - booked, 0);
      if (Math.abs(parsedAdjustment) > available) {
        setAdjustmentError(
          `Cannot reduce by ${Math.abs(parsedAdjustment)} — only ${available} seats are available (${booked} already booked).`
        );
        return;
      }
    }

    setAdjustmentLoading(true);
    setAdjustmentError("");
    setSuccess("");
    try {
      const saved = await saveOwnerSlotAdjustment(restaurant.id, {
        date: adjustmentDate,
        time: adjustmentTime,
        seating_preference: adjustmentPreference,
        adjustment: parsedAdjustment,
      });
      setAdjustmentValue(String(saved?.adjustment ?? parsedAdjustment));
      toast.success("Seat adjustment saved.");
    } catch (err) {
      const rawMessage = String(err?.message || "").toLowerCase();
      const isInternalRuntimeMessage =
        rawMessage.includes("not a function") ||
        rawMessage.includes("reservationservice.") ||
        rawMessage.includes("undefined");
      setAdjustmentError(
        isInternalRuntimeMessage
          ? "Couldn't save seat adjustment."
          : (err.message || "Couldn't save seat adjustment.")
      );
    } finally {
      setAdjustmentLoading(false);
    }
  }

  async function handleAction(reservationId, action) {
    setUpdatingId(reservationId);
    setError("");
    setSuccess("");
    try {
      const existingReservation = reservations.find((reservation) => reservation.id === reservationId) || null;
      let updatedReservation = null;

      if (action === "no-show") {
        await markOwnerReservationNoShow(reservationId);
        updatedReservation = existingReservation
          ? { ...existingReservation, status: "no-show" }
          : null;
      } else {
        updatedReservation = await updateOwnerReservationStatus(reservationId, action);
      }

      await loadReservations();
      const messageMap = {
        accept: "Reservation accepted.",
        reject: "Reservation rejected.",
        "no-show": "Reservation marked as no-show.",
        complete: "Reservation marked as completed.",
      };
      setSuccess(messageMap[action] || "Reservation updated.");
      window.dispatchEvent(
        new CustomEvent("ds:reservation-changed", {
          detail: {
            reservationId,
            restaurantId: updatedReservation?.restaurant_id ?? existingReservation?.restaurant_id,
            date: updatedReservation?.reservation_date ?? existingReservation?.reservation_date,
            time: updatedReservation?.reservation_time ?? existingReservation?.reservation_time,
            action: action === "accept"
              ? "accepted"
              : action === "reject"
                ? "rejected"
                : action === "no-show"
                  ? "no-show"
                  : "completed",
          },
        })
      );
    } catch (err) {
      setError(err.message || "We couldn't update the reservation status. Please try again.");
    } finally {
      setUpdatingId(null);
      setConfirmRejectReservation(null);
    }
  }

  async function handleDeleteReservation(reservationId) {
    setError("");
    setSuccess("");
    setDeletingReservationId(reservationId);
    try {
      await deleteOwnerReservation(reservationId);
      setReservations((prev) => prev.filter((reservation) => reservation.id !== reservationId));
      setSuccess("Reservation deleted.");
      setConfirmDeleteReservation(null);
      return true;
    } catch (err) {
      setError(err.message || "Failed to delete reservation.");
      return false;
    } finally {
      setDeletingReservationId(null);
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
      {success && <div className="inlineToast inlineToast--success">{success}</div>}
      {error && <div className="fieldError">{error}</div>}

      <section className="formCard slotAdjustCard">
        <div className="slotAdjustHeader">
          <h2 className="reservationSection__title">Adjust Available Seats</h2>
          <p className="slotAdjustHint">
            Use negative numbers to reserve seats for walk-ins or staffing limits.
          </p>
        </div>

        <form className="slotAdjustForm" onSubmit={handleSaveAdjustment}>
          <div className="slotAdjustGrid">
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={adjustmentDate}
                onChange={(e) => setAdjustmentDate(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Time</span>
              <input
                type="time"
                value={adjustmentTime}
                onChange={(e) => setAdjustmentTime(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Seating</span>
              <select
                className="select"
                value={adjustmentPreference}
                onChange={(e) => setAdjustmentPreference(e.target.value)}
              >
                <option value="any">Any seating</option>
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
              </select>
            </label>
            <label className="field">
              <span>Seat adjustment (+ to add, − to reduce)</span>
              <input
                type="number"
                step="1"
                value={adjustmentValue}
                min={baseCapacity != null ? -baseCapacity : undefined}
                onChange={(e) => setAdjustmentValue(e.target.value)}
                required
              />
              {(() => {
                const delta = parseInt(adjustmentValue, 10);
                const total = slotAvailability?.total_capacity ?? baseCapacity;
                const booked = slotAvailability?.booked_seats ?? 0;
                const currentlyAvailable = total != null ? Math.max(total - booked, 0) : null;

                if (total == null) return null;

                if (Number.isNaN(delta) || delta === 0) {
                  return (
                    <span className="slotAdjustHint">
                      {total} total &nbsp;·&nbsp; {booked} booked &nbsp;·&nbsp; <strong>{currentlyAvailable} available</strong>
                    </span>
                  );
                }

                const afterAvailable = Math.max(currentlyAvailable + delta, 0);
                const isOver = afterAvailable === 0 && delta < 0 && Math.abs(delta) > currentlyAvailable;
                return (
                  <span className={`slotAdjustHint ${delta < 0 ? "slotAdjustHint--reduce" : "slotAdjustHint--increase"}`}>
                    {total} total &nbsp;·&nbsp; {booked} booked &nbsp;·&nbsp;
                    {currentlyAvailable} → <strong>{afterAvailable} available</strong>
                    {isOver && <span className="slotAdjustHint--reduce"> ⚠ can't reduce below 0</span>}
                  </span>
                );
              })()}
            </label>
          </div>

          {adjustmentFetching && (
            <div className="slotAdjustStatus">Loading current adjustment...</div>
          )}
          {adjustmentError && <div className="fieldError">{adjustmentError}</div>}

          <div className="slotAdjustActions">
            <button
              className="btn btn--ghost"
              type="button"
              onClick={() => setAdjustmentValue("0")}
              disabled={adjustmentLoading}
            >
              Reset to 0
            </button>
            <button className="btn btn--gold" type="submit" disabled={adjustmentLoading || adjustmentFetching}>
              {adjustmentLoading ? "Saving..." : "Save Adjustment"}
            </button>
          </div>
        </form>
      </section>

      <section className="reservationSection">
        <h2 className="reservationSection__title">Upcoming Reservations</h2>
        {upcomingReservations.length === 0 ? (
          <EmptyState
            title="No upcoming reservations"
            message="New reservation requests will appear here for quick approval."
          />
        ) : (
          <div className="reservationList">
            {upcomingReservations.map((reservation) => {
            const normalizedStatus = String(reservation.status || "").toLowerCase();
            const canTakeAction = normalizedStatus === "pending";
            const canMarkOutcome = normalizedStatus === "accepted" || normalizedStatus === "confirmed";
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
                {canMarkOutcome && (
                  <div className="reservationCard__actions ownerReservationActions">
                    <button
                      className="btn btn--gold"
                      type="button"
                      disabled={updatingId === reservation.id}
                      onClick={() => handleAction(reservation.id, "complete")}
                    >
                      Mark Completed
                    </button>
                    <button
                      className="btn btn--ghost"
                      type="button"
                      disabled={updatingId === reservation.id}
                      onClick={() => handleAction(reservation.id, "no-show")}
                    >
                      Mark No-show
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
          <EmptyState
            title="No past reservations yet"
            message="Completed, cancelled, or rejected reservations will show here."
          />
        ) : (
          <div className="reservationList">
            {pastReservations.map((reservation) => {
              const normalizedStatus = String(reservation.status || "").toLowerCase();
              const canMarkOutcome = normalizedStatus === "accepted" || normalizedStatus === "confirmed";
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
                <div className="reservationCard__actions reservationCard__actions--right">
                  <button
                    className="btn btn--ghost"
                    type="button"
                    disabled={deletingReservationId === reservation.id}
                    onClick={() => setConfirmDeleteReservation(reservation)}
                  >
                    {deletingReservationId === reservation.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
                {canMarkOutcome && (
                  <div className="reservationCard__actions ownerReservationActions">
                    <button
                      className="btn btn--gold"
                      type="button"
                      disabled={updatingId === reservation.id}
                      onClick={() => handleAction(reservation.id, "complete")}
                    >
                      Mark Completed
                    </button>
                    <button
                      className="btn btn--ghost"
                      type="button"
                      disabled={updatingId === reservation.id}
                      onClick={() => handleAction(reservation.id, "no-show")}
                    >
                      Mark No-show
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
        <h2 className="reservationSection__title">Event Reservations</h2>
        {upcomingEventReservations.length === 0 && pastEventReservations.length === 0 ? (
          <EmptyState
            title="No event reservations"
            message="Event bookings will appear here once guests reserve your events."
          />
        ) : (
          <>
            {upcomingEventReservations.length > 0 && (
              <div className="reservationList">
                {upcomingEventReservations.map((reservation) => (
                  <article className="reservationCard" key={`event-up-${reservation.id}`}>
                    <div className="reservationCard__top">
                      <div className="reservationCard__name">{reservation.event_title || "Event"}</div>
                      <span className="statusBadge statusBadge--confirmed">Event</span>
                    </div>
                    <div className="reservationCard__meta">
                      Guest: {reservation.user_name || "Guest"} • {reservation.attendees_count || 1} attendee(s)
                    </div>
                    <div className="reservationCard__meta">
                      {formatEventDateTime(reservation)}
                    </div>
                    <div className="reservationCard__meta">
                      Restaurant: {reservation.restaurant_name || "N/A"}
                    </div>
                  </article>
                ))}
              </div>
            )}
            {pastEventReservations.length > 0 && (
              <div className="reservationList">
                {pastEventReservations.map((reservation) => (
                  <article className="reservationCard" key={`event-past-${reservation.id}`}>
                    <div className="reservationCard__top">
                      <div className="reservationCard__name">{reservation.event_title || "Event"}</div>
                      <span className="statusBadge statusBadge--completed">Past</span>
                    </div>
                    <div className="reservationCard__meta">
                      Guest: {reservation.user_name || "Guest"} • {reservation.attendees_count || 1} attendee(s)
                    </div>
                    <div className="reservationCard__meta">
                      {formatEventDateTime(reservation)}
                    </div>
                    <div className="reservationCard__meta">
                      Restaurant: {reservation.restaurant_name || "N/A"}
                    </div>
                    <div className="reservationCard__actions reservationCard__actions--right">
                      <button
                        className="btn btn--ghost"
                        type="button"
                        onClick={() => setConfirmDeleteEventReservation(reservation)}
                        disabled={deletingEventReservationId === reservation.id}
                      >
                        {deletingEventReservationId === reservation.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
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

      <ConfirmDialog
        open={!!confirmDeleteReservation}
        title="Are you sure you want to delete this reservation?"
        message={
          confirmDeleteReservation
            ? `${confirmDeleteReservation.customer_name || "Guest"} • ${formatDateTime(confirmDeleteReservation)}`
            : ""
        }
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        busy={deletingReservationId === confirmDeleteReservation?.id}
        busyLabel="Deleting..."
        onConfirm={async () => {
          if (!confirmDeleteReservation) return;
          const success = await handleDeleteReservation(confirmDeleteReservation.id);
          if (success) {
            setConfirmDeleteReservation(null);
          }
        }}
        onCancel={() => {
          if (deletingReservationId === confirmDeleteReservation?.id) return;
          setConfirmDeleteReservation(null);
        }}
      />

      <ConfirmDialog
        open={!!confirmDeleteEventReservation}
        title="Are you sure you want to delete this reservation?"
        message={
          confirmDeleteEventReservation
            ? `${confirmDeleteEventReservation.event_title || "Event"} • ${formatEventDateTime(confirmDeleteEventReservation)}`
            : ""
        }
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        busy={deletingEventReservationId === confirmDeleteEventReservation?.id}
        busyLabel="Deleting..."
        onConfirm={() => {
          if (!confirmDeleteEventReservation) return;
          handleDeleteEventReservation(confirmDeleteEventReservation.id);
        }}
        onCancel={() => {
          if (deletingEventReservationId === confirmDeleteEventReservation?.id) return;
          setConfirmDeleteEventReservation(null);
        }}
      />
    </div>
  );
}
