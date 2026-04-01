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

const OWNER_RESERVATION_FILTERS_KEY = "ds-owner-reservation-filters";

function getReservationNameValue(reservation) {
  return String(reservation?.customer_name || "").trim().toLowerCase();
}

function sortReservationsList(list, sortBy, isPastList = false) {
  const items = [...list];

  if (sortBy === "az") {
    items.sort((a, b) => getReservationNameValue(a).localeCompare(getReservationNameValue(b)));
    return items;
  }

  items.sort((a, b) => {
    const aTime = toDateTimeValue(a)?.getTime() ?? 0;
    const bTime = toDateTimeValue(b)?.getTime() ?? 0;
    return isPastList ? bTime - aTime : aTime - bTime;
  });

  return items;
}

function filterReservationsByPartySize(list, partySizeFilter) {
  if (partySizeFilter === "all") return list;

  return list.filter((reservation) => {
    return String(reservation?.party_size ?? "") === String(partySizeFilter);
  });
}

function formatPartySizeFilterLabel(value) {
  return value === "all" ? "All" : `${value}`;
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

  const [reservationView, setReservationView] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OWNER_RESERVATION_FILTERS_KEY) || "{}");
      return saved.view || "upcoming";
    } catch {
      return "upcoming";
    }
  });

  const [filtersOpen, setFiltersOpen] = useState(false);

  const [reservationSortBy, setReservationSortBy] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OWNER_RESERVATION_FILTERS_KEY) || "{}");
      return saved.sortBy || "date-time";
    } catch {
      return "date-time";
    }
  });

  const [partySizeFilter, setPartySizeFilter] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OWNER_RESERVATION_FILTERS_KEY) || "{}");
      return saved.partySize || "all";
    } catch {
      return "all";
    }
  });

  useEffect(() => {
    localStorage.setItem(
      OWNER_RESERVATION_FILTERS_KEY,
      JSON.stringify({
        view: reservationView,
        sortBy: reservationSortBy,
        partySize: partySizeFilter,
      })
    );
  }, [reservationView, reservationSortBy, partySizeFilter]);

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

  const { visibleReservations } = useMemo(() => {
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

    const sortedUpcoming = sortReservationsList(upcoming, reservationSortBy, false);
    const sortedPast = sortReservationsList(past, reservationSortBy, true);

    const filteredUpcoming = filterReservationsByPartySize(sortedUpcoming, partySizeFilter);
    const filteredPast = filterReservationsByPartySize(sortedPast, partySizeFilter);

    let visible = filteredUpcoming;

    if (reservationView === "past") {
      visible = filteredPast;
    } else if (reservationView === "all") {
      visible = [...filteredUpcoming, ...filteredPast];
      visible = sortReservationsList(visible, reservationSortBy, false);
    }

    return { visibleReservations: visible };
  }, [reservations, clockNow, reservationSortBy, partySizeFilter, reservationView]);

  async function handleSaveAdjustment(event) {
    event.preventDefault();
    if (!restaurant?.id) return;

    const parsedAdjustment = parseInt(adjustmentValue, 10);
    if (Number.isNaN(parsedAdjustment)) {
      setAdjustmentError("Adjustment must be a valid number.");
      return;
    }

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

      <div className="ownerReservationToolbar">
        <div className="ownerReservationTabs">
          <button
            type="button"
            className={`ownerReservationTabs__btn ${reservationView === "upcoming" ? "is-active" : ""}`}
            onClick={() => setReservationView("upcoming")}
          >
            Upcoming
          </button>

          <button
            type="button"
            className={`ownerReservationTabs__btn ${reservationView === "past" ? "is-active" : ""}`}
            onClick={() => setReservationView("past")}
          >
            Past
          </button>

          <button
            type="button"
            className={`ownerReservationTabs__btn ${reservationView === "all" ? "is-active" : ""}`}
            onClick={() => setReservationView("all")}
          >
            All
          </button>
        </div>

        <button
          type="button"
          className={`searchFilterBtn ${filtersOpen ? "is-active" : ""}`}
          onClick={() => setFiltersOpen(true)}
        >
          ⚙ Filters
        </button>
      </div>

      {filtersOpen && (
        <>
          <div className="ownerReservationFiltersBackdrop" onClick={() => setFiltersOpen(false)} />

          <div className="ownerReservationFiltersModal">
            <div className="ownerReservationFiltersModal__head">
              <div className="ownerReservationFiltersModal__title">Filters</div>
              <button
                type="button"
                className="ownerReservationFiltersModal__close"
                onClick={() => setFiltersOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="ownerReservationFiltersModal__body">
              <div className="ownerReservationFiltersSection">
                <div className="ownerReservationFiltersSection__title">Sort by</div>

                <label className="ownerReservationRadioRow">
                  <input
                    type="radio"
                    name="ownerReservationSort"
                    checked={reservationSortBy === "date-time"}
                    onChange={() => setReservationSortBy("date-time")}
                  />
                  <span>Date & Time</span>
                </label>

                <label className="ownerReservationRadioRow">
                  <input
                    type="radio"
                    name="ownerReservationSort"
                    checked={reservationSortBy === "az"}
                    onChange={() => setReservationSortBy("az")}
                  />
                  <span>A–Z</span>
                </label>
              </div>

              <div className="ownerReservationFiltersSection">
                <div className="ownerReservationFiltersSection__title">Party Size</div>

                <div className="ownerReservationSliderRow">
                  <input
                    className="ownerReservationSlider"
                    type="range"
                    min="0"
                    max="12"
                    step="1"
                    value={partySizeFilter === "all" ? 0 : Number(partySizeFilter)}
                    onChange={(e) => {
                      const nextValue = Number(e.target.value);

                      if (nextValue <= 1) {
                        setPartySizeFilter("all");
                        return;
                      }

                      setPartySizeFilter(String(nextValue));
                    }}
                  />

                  <div className="ownerReservationSliderValue">
                    {formatPartySizeFilterLabel(partySizeFilter)}
                  </div>
                </div>

                <div className="ownerReservationSliderMarks">
                  <span>All</span>
                  <span>2</span>
                  <span>4</span>
                  <span>6</span>
                  <span>8</span>
                  <span>10</span>
                  <span>12</span>
                </div>

                <div className="ownerReservationSliderHint">
                  Slide to filter by an exact party size. Move it to the far left for all party sizes.
                </div>
              </div>
            </div>

            <div className="ownerReservationFiltersModal__footer">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setReservationSortBy("date-time");
                  setPartySizeFilter("all");
                }}
              >
                Reset
              </button>

              <button
                type="button"
                className="btn btn--gold"
                onClick={() => setFiltersOpen(false)}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </>
      )}

      <section className="reservationSection">
        <h2 className="reservationSection__title">
          {reservationView === "upcoming"
            ? "Upcoming Reservations"
            : reservationView === "past"
              ? "Past Reservations"
              : "All Reservations"}
        </h2>

        {visibleReservations.length === 0 ? (
          <EmptyState
            title="No reservations found"
            message="Try another filter combination or switch between Upcoming, Past, and All."
          />
        ) : (
          <div className="reservationList">
            {visibleReservations.map((reservation) => {
              const normalizedStatus = String(reservation.status || "").toLowerCase();
              const isPastCard = reservationView === "past" || (
                reservationView === "all" &&
                (normalizedStatus === "cancelled" ||
                  normalizedStatus === "rejected" ||
                  normalizedStatus === "completed" ||
                  normalizedStatus === "no-show" ||
                  (toDateTimeValue(reservation)?.getTime() ?? 0) < clockNow)
              );

              const canTakeAction = normalizedStatus === "pending" && !isPastCard;
              const canMarkOutcome = (normalizedStatus === "accepted" || normalizedStatus === "confirmed") && !isPastCard;

              return (
                <article className="reservationCard" key={reservation.id}>
                  <div className="reservationCard__top">
                    <div>
                      <div className="reservationCard__name">{reservation.customer_name || "Guest"}</div>

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
                    </div>

                    <div className="reservationCard__statusWrap">
                      <span className={toStatusClass(reservation.status)}>
                        {formatOwnerReservationStatus(reservation.status)}
                      </span>
                    </div>
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