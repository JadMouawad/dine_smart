import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getMyRestaurant, getOwnerRestaurantTableConfig } from "../../services/restaurantService";
import {
  getOwnerReservations,
  updateOwnerReservationStatus,
  markOwnerReservationNoShow,
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

const OWNER_RESERVATION_SORT_KEY = "ds-owner-reservations-sort";

function getReservationNameValue(reservation) {
  return String(reservation?.customer_name || "").trim().toLowerCase();
}

function getReservationPartySizeValue(reservation) {
  const value = Number(reservation?.party_size);
  return Number.isFinite(value) ? value : 0;
}

function sortReservationsList(list, sortBy, isPastList = false) {
  const items = [...list];

  if (sortBy === "name") {
    items.sort((a, b) => getReservationNameValue(a).localeCompare(getReservationNameValue(b)));
    return items;
  }

  if (sortBy === "party-size") {
    items.sort((a, b) => getReservationPartySizeValue(b) - getReservationPartySizeValue(a));
    return items;
  }

  // default: time
  items.sort((a, b) => {
    const aTime = toDateTimeValue(a)?.getTime() ?? 0;
    const bTime = toDateTimeValue(b)?.getTime() ?? 0;
    return isPastList ? bTime - aTime : aTime - bTime;
  });

  return items;
}

export default function OwnerReservations() {
  const [restaurant, setRestaurant] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [confirmRejectReservation, setConfirmRejectReservation] = useState(null);
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
  const [sortBy, setSortBy] = useState(() => {
  return localStorage.getItem(OWNER_RESERVATION_SORT_KEY) || "time";
});

useEffect(() => {
  localStorage.setItem(OWNER_RESERVATION_SORT_KEY, sortBy);
}, [sortBy]);

  async function loadReservations() {
    setError("");
    try {
      const data = await getOwnerReservations();
      setReservations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "We couldn't load reservations. Please refresh and try again.");
      setReservations([]);
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

  return {
    upcomingReservations: sortReservationsList(upcoming, sortBy, false),
    pastReservations: sortReservationsList(past, sortBy, true),
  };
}, [reservations, clockNow, sortBy]);

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

<div className="ownerReservationSortBar">
  <span className="ownerReservationSortBar__label">Sort by</span>

  <button
    type="button"
    className={`ownerReservationSortChip ${sortBy === "time" ? "is-active" : ""}`}
    onClick={() => setSortBy("time")}
  >
    Time
  </button>

  <button
    type="button"
    className={`ownerReservationSortChip ${sortBy === "name" ? "is-active" : ""}`}
    onClick={() => setSortBy("name")}
  >
    Name
  </button>

  <button
    type="button"
    className={`ownerReservationSortChip ${sortBy === "party-size" ? "is-active" : ""}`}
    onClick={() => setSortBy("party-size")}
  >
    Party Size
  </button>
</div>

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
