import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getMyRestaurant, getOwnerRestaurantTableConfig } from "../../services/restaurantService";
import {
  getOwnerReservations,
  updateOwnerReservationStatus,
  markOwnerReservationNoShow,
  deleteOwnerReservation,
  getOwnerSlotAdjustment,
  saveOwnerSlotAdjustment,
  getReservationAvailability,
  getOwnerDisabledSlots,
  saveOwnerDisabledSlot,
} from "../../services/reservationService";
import { getOwnerEventReservations } from "../../services/restaurantService";
import { markEventAttendeeNoShow } from "../../services/eventService";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import OwnerReservationCalendar from "../../components/OwnerReservationCalendar.jsx";
import ThemedSelect from "../../components/ThemedSelect.jsx";

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
  const startLabel = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const duration = parseInt(reservation.duration_minutes, 10) || 120;
  const endDate = new Date(date.getTime() + duration * 60 * 1000);
  const endLabel = endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${date.toLocaleDateString()} · ${startLabel} – ${endLabel}`;
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
const OWNER_RESERVATION_SECTION_KEY = "ds-owner-reservation-section";

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

function filterReservationsByStatus(list, statusFilter) {
  if (statusFilter === "all") return list;

  return list.filter((reservation) => {
    const normalizedStatus = formatOwnerReservationStatus(reservation?.status);
    return normalizedStatus === statusFilter;
  });
}

function normalizeSeatingValue(value) {
  return String(value || "any").trim().toLowerCase();
}

function normalizeTimeValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.slice(0, 5);
  }

  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const meridiem = match[3].toUpperCase();

    if (meridiem === "AM" && hours === 12) hours = 0;
    if (meridiem === "PM" && hours !== 12) hours += 12;

    return `${pad2(hours)}:${minutes}`;
  }

  const parsed = new Date(`2000-01-01 ${raw}`);
  if (!Number.isNaN(parsed.getTime())) {
    return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
  }

  return raw.slice(0, 5);
}

function formatDisabledSlotLabel(slot) {
  const normalized = normalizeTimeValue(slot?.reservation_time);
  const [hours = "00", minutes = "00"] = normalized.split(":");
  const asDate = new Date(`2000-01-01T${hours}:${minutes}:00`);
  const timeLabel = !Number.isNaN(asDate.getTime())
    ? asDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : normalized;

  const seating = normalizeSeatingValue(slot?.seating_preference);
  const seatingLabel = seating === "any"
    ? "All seating"
    : seating.charAt(0).toUpperCase() + seating.slice(1);

  return `${timeLabel} • ${seatingLabel}`;
}

function formatPartySizeFilterLabel(value) {
  return value === "all" ? "All" : `${value}`;
}

function createDisabledSlotDraft(slotNumber = 1) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    slotNumber,
    date: getTodayDateValue(),
    time: getRoundedTimeValue(),
    seatingPreference: "any",
    reason: "",
    isDisabled: false,
    loading: false,
    error: "",
  };
}

const SEATING_OPTIONS = [
  { value: "any", label: "Any seating" },
  { value: "indoor", label: "Indoor" },
  { value: "outdoor", label: "Outdoor" },
];

const RESERVATION_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
  { value: "no-show", label: "No-show" },
  { value: "pending", label: "Pending" },
];

const CHART_RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 2 weeks" },
  { value: "30d", label: "Last month" },
  { value: "90d", label: "Last 3 months" },
  { value: "365d", label: "Last year" },
];

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(value, amount) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function addMonths(value, amount) {
  const date = new Date(value);
  date.setMonth(date.getMonth() + amount);
  return date;
}

function startOfWeek(value) {
  const date = startOfDay(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function formatChartDateLabel(value) {
  return value.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatLocalDateKey(value) {
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
}

function formatChartWeekLabel(value) {
  const start = startOfDay(value);
  const end = addDays(start, 6);
  const startLabel = start.toLocaleDateString([], { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString([], { day: "numeric" });
  return `${startLabel}-${endLabel}`;
}

function formatChartMonthLabel(value) {
  return value.toLocaleDateString([], { month: "short" });
}

function formatChartHourLabel(value) {
  const [hours = "00", minutes = "00"] = String(value || "00:00").split(":");
  const date = new Date(`2000-01-01T${hours}:${minutes}:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function getReservationChartConfig(rangeValue, now = new Date()) {
  const normalizedNow = new Date(now);
  let buckets = [];
  let mode = "day";
  let bucketSizeDays = 1;
  let start = startOfDay(normalizedNow);
  let title = CHART_RANGE_OPTIONS.find((option) => option.value === rangeValue)?.label || "Last 7 days";
  let groupLabel = "Daily reservations";

  if (rangeValue === "30d") {
    mode = "rolling-week";
    bucketSizeDays = 7;
    groupLabel = "Weekly reservations";
    const rangeStart = startOfDay(addDays(normalizedNow, -29));
    start = rangeStart;
    for (let cursor = new Date(rangeStart); cursor <= normalizedNow; cursor = addDays(cursor, 7)) {
      const bucketStart = new Date(cursor);
      buckets.push({
        key: formatLocalDateKey(bucketStart),
        label: formatChartWeekLabel(bucketStart),
      });
    }
  } else if (rangeValue === "90d") {
    mode = "month";
    groupLabel = "Monthly reservations";
    start = new Date(normalizedNow.getFullYear(), normalizedNow.getMonth() - 2, 1);
    for (let cursor = new Date(start); cursor <= normalizedNow; cursor = addMonths(cursor, 1)) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      buckets.push({
        key: `${monthStart.getFullYear()}-${pad2(monthStart.getMonth() + 1)}`,
        label: formatChartMonthLabel(monthStart),
      });
    }
  } else if (rangeValue === "365d") {
    mode = "month";
    groupLabel = "Monthly reservations";
    start = new Date(normalizedNow.getFullYear(), normalizedNow.getMonth() - 11, 1);
    for (let cursor = new Date(start); cursor <= normalizedNow; cursor = addMonths(cursor, 1)) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      buckets.push({
        key: `${monthStart.getFullYear()}-${pad2(monthStart.getMonth() + 1)}`,
        label: formatChartMonthLabel(monthStart),
      });
    }
  } else {
    const days = rangeValue === "14d" ? 14 : 7;
    start = startOfDay(addDays(normalizedNow, -(days - 1)));
    for (let cursor = new Date(start); cursor <= normalizedNow; cursor = addDays(cursor, 1)) {
      const day = new Date(cursor);
      buckets.push({
        key: formatLocalDateKey(day),
        label: formatChartDateLabel(day),
      });
    }
  }

  return {
    start,
    end: endOfDay(normalizedNow),
    mode,
    bucketSizeDays,
    title,
    groupLabel,
    buckets,
  };
}

function sameDisabledSlot(slot, draft) {
  return (
    String(slot?.reservation_date || "") === String(draft?.date || draft?.reservation_date || "") &&
    normalizeTimeValue(slot?.reservation_time) === normalizeTimeValue(draft?.time || draft?.reservation_time) &&
    normalizeSeatingValue(slot?.seating_preference) ===
      normalizeSeatingValue(draft?.seatingPreference || draft?.seating_preference)
  );
}

export default function OwnerReservations() {
  const [restaurant, setRestaurant] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [updatingId, setUpdatingId] = useState(null);
  const [confirmRejectReservation, setConfirmRejectReservation] = useState(null);
  const [confirmDeleteReservation, setConfirmDeleteReservation] = useState(null);
  const [deletingReservationId, setDeletingReservationId] = useState(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [focusedReservationId, setFocusedReservationId] = useState(null);

  const [adjustmentDate, setAdjustmentDate] = useState(getTodayDateValue());
  const [adjustmentTime, setAdjustmentTime] = useState(getRoundedTimeValue());
  const [adjustmentPreference, setAdjustmentPreference] = useState("any");
  const [adjustmentValue, setAdjustmentValue] = useState("0");
  const [adjustmentLoading, setAdjustmentLoading] = useState(false);
  const [adjustmentFetching, setAdjustmentFetching] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState("");
  const [baseCapacity, setBaseCapacity] = useState(null);
  const [slotAvailability, setSlotAvailability] = useState(null);

  const [disabledSlotDrafts, setDisabledSlotDrafts] = useState([createDisabledSlotDraft(1)]);
  const [disabledSlotsByDate, setDisabledSlotsByDate] = useState({});
  const [disabledSlotsLoadingByDate, setDisabledSlotsLoadingByDate] = useState({});
  const [adjustmentSeatingOpen, setAdjustmentSeatingOpen] = useState(false);
  const [openDraftSeatingId, setOpenDraftSeatingId] = useState(null);
  const [activeSection, setActiveSection] = useState(() => {
    try {
      return localStorage.getItem(OWNER_RESERVATION_SECTION_KEY) || "calendar";
    } catch {
      return "calendar";
    }
  });

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

  const [statusFilter, setStatusFilter] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OWNER_RESERVATION_FILTERS_KEY) || "{}");
      return saved.status || "all";
    } catch {
      return "all";
    }
  });
  const [chartRange, setChartRange] = useState("14d");

  // Event attendees state
  const [eventAttendees, setEventAttendees] = useState([]);
  const [eventAttendeesLoading, setEventAttendeesLoading] = useState(false);
  const [eventAttendeesError, setEventAttendeesError] = useState("");
  const [noShowingAttendeeId, setNoShowingAttendeeId] = useState(null);
  const [eventAttendeesView, setEventAttendeesView] = useState("upcoming");
  const [eventAttendeesStatusFilter, setEventAttendeesStatusFilter] = useState("all");

  const appliedFiltersCount = useMemo(() => {
    let count = 0;

    if (statusFilter !== "all") count += 1;
    if (reservationSortBy !== "date-time") count += 1;
    if (partySizeFilter !== "all") count += 1;

    return count;
  }, [statusFilter, reservationSortBy, partySizeFilter]);

  useEffect(() => {
    try {
      localStorage.setItem(OWNER_RESERVATION_SECTION_KEY, activeSection);
    } catch {}
  }, [activeSection]);

  useEffect(() => {
    setAdjustmentSeatingOpen(false);
    setOpenDraftSeatingId(null);
  }, [activeSection]);

  useEffect(() => {
    localStorage.setItem(
      OWNER_RESERVATION_FILTERS_KEY,
      JSON.stringify({
        view: reservationView,
        sortBy: reservationSortBy,
        partySize: partySizeFilter,
        status: statusFilter,
      })
    );
  }, [reservationView, reservationSortBy, partySizeFilter, statusFilter]);

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

  async function loadEventAttendees() {
    setEventAttendeesLoading(true);
    setEventAttendeesError("");
    try {
      const data = await getOwnerEventReservations();
      setEventAttendees(Array.isArray(data) ? data : []);
    } catch (err) {
      setEventAttendeesError(err.message || "Failed to load event attendees.");
    } finally {
      setEventAttendeesLoading(false);
    }
  }

  useEffect(() => {
    if (activeSection === "event-attendees") {
      loadEventAttendees();
    }
  }, [activeSection]);

  async function handleEventAttendeeNoShow(attendeeId) {
    setNoShowingAttendeeId(attendeeId);
    try {
      const att = eventAttendees.find((a) => a.id === attendeeId);
      await markEventAttendeeNoShow(att?.event_id, attendeeId);
      setEventAttendees((prev) =>
        prev.map((a) => (a.id === attendeeId ? { ...a, status: "no-show" } : a))
      );
      toast.success("Attendee marked as no-show.");
    } catch (err) {
      toast.error(err.message || "Failed to mark no-show.");
    } finally {
      setNoShowingAttendeeId(null);
    }
  }

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
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadReservations();
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      loadReservations();
    }, 20000);

    function onReservationChanged() {
      loadReservations();
    }

    window.addEventListener("ds:reservation-changed", onReservationChanged);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("ds:reservation-changed", onReservationChanged);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const disabledDraftSignature = useMemo(
    () =>
      disabledSlotDrafts
        .map((draft) => `${draft.date}|${normalizeTimeValue(draft.time)}|${normalizeSeatingValue(draft.seatingPreference)}`)
        .join("||"),
    [disabledSlotDrafts]
  );

  useEffect(() => {
    if (!restaurant?.id || disabledSlotDrafts.length === 0) return;

    const uniqueDates = [...new Set(disabledSlotDrafts.map((draft) => draft.date).filter(Boolean))];
    if (uniqueDates.length === 0) return;

    let cancelled = false;

    async function loadDisabledSlotsForDraftDates() {
      try {
        await Promise.all(
          uniqueDates.map(async (dateValue) => {
            setDisabledSlotsLoadingByDate((prev) => ({
              ...prev,
              [dateValue]: true,
            }));

            try {
              const data = await getOwnerDisabledSlots({
                restaurantId: restaurant.id,
                date: dateValue,
              });

              if (cancelled) return;

              const nextSlots = Array.isArray(data) ? data : [];

              setDisabledSlotsByDate((prev) => ({
                ...prev,
                [dateValue]: nextSlots,
              }));
            } catch {
              if (cancelled) return;

              setDisabledSlotsByDate((prev) => ({
                ...prev,
                [dateValue]: [],
              }));
            } finally {
              if (!cancelled) {
                setDisabledSlotsLoadingByDate((prev) => ({
                  ...prev,
                  [dateValue]: false,
                }));
              }
            }
          })
        );

        if (cancelled) return;

        setDisabledSlotDrafts((prevDrafts) =>
          prevDrafts.map((draft) => {
            const slotsForDate = (disabledSlotsByDate[draft.date] || []).slice();
            const matchedSlot = slotsForDate.find((slot) => sameDisabledSlot(slot, draft));

            return {
              ...draft,
              isDisabled: Boolean(matchedSlot),
              reason: matchedSlot ? String(matchedSlot.reason || draft.reason || "") : draft.reason,
              error: "",
            };
          })
        );
      } catch {
        // no-op
      }
    }

    loadDisabledSlotsForDraftDates();

    return () => {
      cancelled = true;
    };
  }, [restaurant?.id, disabledDraftSignature]);

  useEffect(() => {
    setDisabledSlotDrafts((prevDrafts) =>
      prevDrafts.map((draft) => {
        const slotsForDate = disabledSlotsByDate[draft.date] || [];
        const matchedSlot = slotsForDate.find((slot) => sameDisabledSlot(slot, draft));
        return {
          ...draft,
          isDisabled: Boolean(matchedSlot),
          reason: matchedSlot ? String(matchedSlot.reason || draft.reason || "") : draft.reason,
        };
      })
    );
  }, [disabledSlotsByDate]);

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

    const filteredUpcomingByParty = filterReservationsByPartySize(sortedUpcoming, partySizeFilter);
    const filteredPastByParty = filterReservationsByPartySize(sortedPast, partySizeFilter);

    const filteredUpcoming = filterReservationsByStatus(filteredUpcomingByParty, statusFilter);
    const filteredPast = filterReservationsByStatus(filteredPastByParty, statusFilter);

    let visible = filteredUpcoming;

    if (reservationView === "past") {
      visible = filteredPast;
    } else if (reservationView === "all") {
      visible = [...filteredUpcoming, ...filteredPast];
      visible = sortReservationsList(visible, reservationSortBy, false);
    }

    return { visibleReservations: visible };
  }, [reservations, clockNow, reservationSortBy, partySizeFilter, statusFilter, reservationView]);

  const reservationCharts = useMemo(() => {
    const config = getReservationChartConfig(chartRange, new Date(clockNow));
    const byDay = new Map(config.buckets.map((bucket) => [bucket.key, 0]));
    const guestsByDay = new Map(config.buckets.map((bucket) => [bucket.key, 0]));
    const byHour = new Map();
    const guestsByHour = new Map();

    reservations.forEach((reservation) => {
      const reservationDate = toDateTimeValue(reservation);
      if (!reservationDate) return;
      if (reservationDate < config.start || reservationDate > config.end) return;
      const guestCount = Math.max(1, parseInt(reservation.party_size, 10) || 1);

      let dateKey = formatLocalDateKey(reservationDate);
      if (config.mode === "week") {
        dateKey = formatLocalDateKey(startOfWeek(reservationDate));
      } else if (config.mode === "rolling-week") {
        const diffDays = Math.floor((startOfDay(reservationDate).getTime() - config.start.getTime()) / 86400000);
        const bucketIndex = Math.max(0, Math.floor(diffDays / config.bucketSizeDays));
        const bucket = config.buckets[Math.min(bucketIndex, config.buckets.length - 1)];
        dateKey = bucket?.key || dateKey;
      } else if (config.mode === "month") {
        dateKey = `${reservationDate.getFullYear()}-${pad2(reservationDate.getMonth() + 1)}`;
      }

      const hourKey = `${pad2(reservationDate.getHours())}:00`;

      byDay.set(dateKey, (byDay.get(dateKey) || 0) + 1);
      guestsByDay.set(dateKey, (guestsByDay.get(dateKey) || 0) + guestCount);
      byHour.set(hourKey, (byHour.get(hourKey) || 0) + 1);
      guestsByHour.set(hourKey, (guestsByHour.get(hourKey) || 0) + guestCount);
    });

    const dayData = config.buckets.map((bucket) => ({
      label: bucket.key,
      shortLabel: bucket.label,
      value: byDay.get(bucket.key) || 0,
      guests: guestsByDay.get(bucket.key) || 0,
    }));

    const hourData = [...byHour.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([label, value]) => ({
        label,
        shortLabel: formatChartHourLabel(label),
        value,
        guests: guestsByHour.get(label) || 0,
      }));

    const peakHour = hourData.reduce((best, item) => (item.value > (best?.value || 0) ? item : best), null);

    return {
      title: config.title,
      groupLabel: config.groupLabel,
      dayData,
      hourData,
      peakHour,
    };
  }, [reservations, chartRange, clockNow]);

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

  function updateDraft(draftId, updater) {
    setDisabledSlotDrafts((prev) =>
      prev.map((draft) => (draft.id === draftId ? updater(draft) : draft))
    );
  }

  function addDisabledSlotDraft() {
    setDisabledSlotDrafts((prev) => {
      const nextSlotNumber =
        prev.length > 0
          ? Math.max(...prev.map((draft) => draft.slotNumber || 0)) + 1
          : 1;

      return [createDisabledSlotDraft(nextSlotNumber), ...prev];
    });
  }

  function removeDisabledSlotDraft(draftId) {
    setDisabledSlotDrafts((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((draft) => draft.id !== draftId);
    });
  }

  async function refreshDisabledSlotsForDate(dateValue) {
    if (!restaurant?.id || !dateValue) return;
    setDisabledSlotsLoadingByDate((prev) => ({ ...prev, [dateValue]: true }));
    try {
      const data = await getOwnerDisabledSlots({ restaurantId: restaurant.id, date: dateValue });
      setDisabledSlotsByDate((prev) => ({
        ...prev,
        [dateValue]: Array.isArray(data) ? data : [],
      }));
    } catch {
      setDisabledSlotsByDate((prev) => ({ ...prev, [dateValue]: [] }));
    } finally {
      setDisabledSlotsLoadingByDate((prev) => ({ ...prev, [dateValue]: false }));
    }
  }

  async function handleToggleDisabledSlot(event, draft) {
    event.preventDefault();
    if (!restaurant?.id) return;

    const dateValue = String(draft?.date || "").trim();
    const timeValue = normalizeTimeValue(draft?.time);
    const seatingPref = normalizeSeatingValue(draft?.seatingPreference);

    if (!dateValue) {
      updateDraft(draft.id, (current) => ({ ...current, error: "Please choose a date." }));
      return;
    }

    if (!timeValue) {
      updateDraft(draft.id, (current) => ({ ...current, error: "Please choose a time." }));
      return;
    }

    updateDraft(draft.id, (current) => ({ ...current, loading: true, error: "" }));

    try {
      const allForDate = disabledSlotsByDate[dateValue] || [];
      const alreadyDisabled = allForDate.some((slot) =>
        sameDisabledSlot(slot, {
          ...draft,
          date: dateValue,
          time: timeValue,
          seatingPreference: seatingPref,
        })
      );

      const saved = await saveOwnerDisabledSlot(restaurant.id, {
        date: dateValue,
        time: timeValue,
        seating_preference: seatingPref === "any" ? "any" : seatingPref,
        reason: draft.reason || null,
        disabled: !alreadyDisabled,
      });

      const nextDisabled = Boolean(saved?.disabled);

      updateDraft(draft.id, (current) => ({
        ...current,
        loading: false,
        isDisabled: nextDisabled,
        reason: String(saved?.reason || current.reason || ""),
        error: "",
      }));

      await refreshDisabledSlotsForDate(draft.date);

      toast.success(nextDisabled ? "Time slot disabled." : "Time slot re-enabled.");
    } catch (err) {
      updateDraft(draft.id, (current) => ({
        ...current,
        loading: false,
        error: err.message || "Couldn't update the disabled state for this slot.",
      }));
    }
  }

  async function handleAction(reservationId, action) {
    setUpdatingId(reservationId);
    setError("");

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
      toast.success(messageMap[action] || "Reservation updated.");

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

  function handleCalendarReservationClick(reservation) {
    if (!reservation?.id) return;

    setActiveSection("reservations");
    setReservationView("all");
    setPartySizeFilter("all");
    setReservationSortBy("date-time");
    setStatusFilter("all");
    setFocusedReservationId(reservation.id);

    window.setTimeout(() => {
      const element = document.getElementById(`owner-reservation-card-${reservation.id}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);

    window.setTimeout(() => {
      setFocusedReservationId((current) => (current === reservation.id ? null : current));
    }, 2500);
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

      {error && <div className="fieldError">{error}</div>}

      <div className="ownerReservationSectionSwitcher">
        <button
          type="button"
          className={`ownerReservationSectionSwitcher__btn ${activeSection === "calendar" ? "is-active" : ""}`}
          onClick={() => setActiveSection("calendar")}
        >
          Calendar
        </button>

        <button
          type="button"
          className={`ownerReservationSectionSwitcher__btn ${activeSection === "charts" ? "is-active" : ""}`}
          onClick={() => setActiveSection("charts")}
        >
          Charts
        </button>

        <button
          type="button"
          className={`ownerReservationSectionSwitcher__btn ${activeSection === "seat-adjustment" ? "is-active" : ""}`}
          onClick={() => setActiveSection("seat-adjustment")}
        >
          Seat Adjustment
        </button>

        <button
          type="button"
          className={`ownerReservationSectionSwitcher__btn ${activeSection === "disable-slot" ? "is-active" : ""}`}
          onClick={() => setActiveSection("disable-slot")}
        >
          Disable Time Slot
        </button>

        <button
          type="button"
          className={`ownerReservationSectionSwitcher__btn ${activeSection === "reservations" ? "is-active" : ""}`}
          onClick={() => setActiveSection("reservations")}
        >
          Reservations
        </button>

        <button
          type="button"
          className={`ownerReservationSectionSwitcher__btn ${activeSection === "event-attendees" ? "is-active" : ""}`}
          onClick={() => setActiveSection("event-attendees")}
        >
          Event Attendees
        </button>
      </div>

      {activeSection === "calendar" && (
        <div className="ownerReservationPanel">
          <OwnerReservationCalendar
            reservations={reservations}
            onReservationClick={handleCalendarReservationClick}
          />
        </div>
      )}

      {activeSection === "charts" && (
        <section className="formCard reservationChartCard ownerReservationPanel">
          <div className="slotAdjustHeader slotAdjustHeader--row reservationChartHeader">
            <div>
              <h2 className="reservationSection__title">Reservation Charts</h2>
              <p className="slotAdjustHint">
                Track reservation volume and spot your busiest hours across flexible time ranges.
              </p>
            </div>

            <div className="reservationChartRange">
              <span className="reservationChartRange__label">Time range</span>
              <ThemedSelect
                className="reservationChartRange__select"
                value={chartRange}
                onChange={setChartRange}
                options={CHART_RANGE_OPTIONS}
                ariaLabel="Select reservation chart time range"
                align="right"
                minMenuWidth="180px"
                fullWidth={false}
              />
            </div>
          </div>

          <div className="reservationChartsGrid">
            <div className="reservationChartPanel">
              <div className="reservationChartPanel__title">{reservationCharts.title}</div>
              <div className="reservationChartPanel__meta">{reservationCharts.groupLabel}</div>
              {reservationCharts.dayData.length ? (
                <div className="reservationBarChart">
                  {reservationCharts.dayData.map((item) => {
                    const max = Math.max(...reservationCharts.dayData.map((entry) => entry.value), 1);
                    const height = Math.max(14, Math.round((item.value / max) * 100));
                    const guestLabel = item.guests === 1 ? "guest" : "guests";

                    return (
                      <div
                        className="reservationBarChart__item"
                        key={item.label}
                        data-tooltip={`${item.shortLabel}: ${item.guests} ${guestLabel}`}
                        tabIndex={0}
                      >
                        <div className="reservationBarChart__value">{item.value}</div>
                        <div className="reservationBarChart__barWrap">
                          <div
                            className="reservationBarChart__bar"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <div className="reservationBarChart__label">{item.shortLabel}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="profileEmpty">No reservation data yet.</div>
              )}
            </div>

            <div className="reservationChartPanel">
              <div className="reservationChartPanel__title">Peak hours</div>
              <div className="reservationChartPanel__meta">Based on the selected time range</div>
              {reservationCharts.hourData.length ? (
                <>
                  <div className="reservationPeakBadge">
                    Peak hour: {reservationCharts.peakHour?.shortLabel || "N/A"} ({reservationCharts.peakHour?.value || 0} reservations)
                  </div>

                  <div className="reservationHourList">
                    {reservationCharts.hourData.map((item) => {
                      const max = Math.max(...reservationCharts.hourData.map((entry) => entry.value), 1);
                      const width = Math.max(8, Math.round((item.value / max) * 100));
                      const isPeak = item.label === reservationCharts.peakHour?.label;
                      const guestLabel = item.guests === 1 ? "guest" : "guests";

                      return (
                        <div
                          className="reservationHourRow"
                          key={item.label}
                          data-tooltip={`${item.shortLabel}: ${item.guests} ${guestLabel}`}
                          tabIndex={0}
                        >
                          <div className="reservationHourRow__label">{item.shortLabel}</div>
                          <div className="reservationHourRow__track">
                            <div
                              className={`reservationHourRow__fill ${isPeak ? "is-peak" : ""}`}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                          <div className="reservationHourRow__value">{item.value}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="profileEmpty">Peak hours will appear once reservations are added.</div>
              )}
            </div>
          </div>
        </section>
      )}

      {activeSection === "seat-adjustment" && (
        <section className="formCard slotAdjustCard ownerReservationPanel">
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
                <ThemedSelect
                  value={adjustmentPreference}
                  onChange={setAdjustmentPreference}
                  options={SEATING_OPTIONS}
                  placeholder="Any seating"
                  ariaLabel="Select seating"
                />
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
      )}

      {activeSection === "disable-slot" && (
        <section className="formCard slotAdjustCard ownerReservationPanel">
          <div className="slotAdjustHeader slotAdjustHeader--row">
            <div>
              <h2 className="reservationSection__title">Disable Specific Time Slots</h2>
              <p className="slotAdjustHint">
                Disabled slots are greyed out for users and cannot be booked until you re-enable them.
              </p>
            </div>

            <button
              type="button"
              className="slotDraftAddBtn"
              onClick={addDisabledSlotDraft}
              aria-label="Add another slot"
              title="Add another slot"
            >
              +
            </button>
          </div>

          <div className="slotDraftStack">
            {disabledSlotDrafts.map((draft) => {
              const allForDate = disabledSlotsByDate[draft.date] || [];
              const currentMatchedSlot = allForDate.find((slot) => sameDisabledSlot(slot, draft));
              const otherDisabledSlots = allForDate.filter((slot) => !sameDisabledSlot(slot, draft));
              const isDateLoading = Boolean(disabledSlotsLoadingByDate[draft.date]);

              return (
                <form
                  key={draft.id}
                  className="slotDraftCard"
                  onSubmit={(event) => handleToggleDisabledSlot(event, draft)}
                >
                  <div className="slotDraftCard__top">
                    <div className="slotDraftCard__titleWrap">
                      <div className="slotDraftCard__title">Slot {draft.slotNumber}</div>
                      <div className="slotDraftCard__subtitle">
                        Configure, disable, or re-enable this slot.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="slotDraftRemoveBtn"
                      onClick={() => removeDisabledSlotDraft(draft.id)}
                      disabled={draft.loading}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="slotAdjustGrid">
                    <label className="field">
                      <span>Date</span>
                      <input
                        type="date"
                        value={draft.date}
                        onChange={(e) =>
                          updateDraft(draft.id, (current) => ({
                            ...current,
                            date: e.target.value,
                            error: "",
                          }))
                        }
                        required
                      />
                    </label>

                    <label className="field">
                      <span>Time</span>
                      <input
                        type="time"
                        value={normalizeTimeValue(draft.time)}
                        onChange={(e) =>
                          updateDraft(draft.id, (current) => ({
                            ...current,
                            time: e.target.value,
                            error: "",
                          }))
                        }
                        required
                      />
                    </label>

                    <label className="field">
                      <span>Seating</span>
                      <ThemedSelect
                        value={draft.seatingPreference}
                        onChange={(nextValue) => {
                          updateDraft(draft.id, (current) => ({
                            ...current,
                            seatingPreference: nextValue,
                            error: "",
                          }));
                          setOpenDraftSeatingId(null);
                        }}
                        options={SEATING_OPTIONS}
                        placeholder="Any seating"
                        ariaLabel="Select seating"
                      />
                    </label>

                    <label className="field">
                      <span>Reason (optional)</span>
                      <input
                        type="text"
                        maxLength={250}
                        value={draft.reason}
                        onChange={(e) =>
                          updateDraft(draft.id, (current) => ({
                            ...current,
                            reason: e.target.value,
                            error: "",
                          }))
                        }
                        placeholder="Closure, private event, kitchen pause..."
                      />
                    </label>
                  </div>

                  <div className="slotStateRow">
                    <span
                      className={`statusBadge slotStatePill ${
                        currentMatchedSlot ? "slotStatePill--disabled" : "slotStatePill--enabled"
                      }`}
                    >
                      {currentMatchedSlot ? "Disabled" : "Enabled"}
                    </span>
                  </div>

                  {isDateLoading && (
                    <div className="slotAdjustStatus">Loading disabled slots...</div>
                  )}

                  {draft.error && <div className="fieldError">{draft.error}</div>}

                  {otherDisabledSlots.length > 0 && (
                    <div className="disabledSlotsPanel">
                      <div className="disabledSlotsPanel__title">
                        Other disabled slots on {draft.date}
                      </div>

                      <div className="disabledSlotsList">
                        {otherDisabledSlots.map((slot) => (
                          <div
                            className="disabledSlotChip"
                            key={`${slot.id || "slot"}-${slot.reservation_time}-${slot.seating_preference}`}
                          >
                            <span>{formatDisabledSlotLabel(slot)}</span>
                            {slot.reason ? <span className="disabledSlotChip__reason">{slot.reason}</span> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="slotAdjustActions">
                    <button
                      className="btn btn--ghost"
                      type="button"
                      onClick={() =>
                        updateDraft(draft.id, (current) => ({
                          ...current,
                          reason: "",
                          error: "",
                        }))
                      }
                      disabled={draft.loading}
                    >
                      Clear Reason
                    </button>

                    <button
                      className="btn btn--gold"
                      type="submit"
                      disabled={draft.loading || isDateLoading}
                    >
                      {draft.loading ? "Saving..." : currentMatchedSlot ? "Re-enable Slot" : "Disable Slot"}
                    </button>
                  </div>
                </form>
              );
            })}
          </div>
        </section>
      )}

      {activeSection === "reservations" && (
        <div className="ownerReservationPanel">
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
              {appliedFiltersCount > 0 && (
                <span className="searchFilterBtn__badge">{appliedFiltersCount}</span>
              )}
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
                    <div className="ownerReservationFiltersSection__title">Status</div>

                    <ThemedSelect
                      value={statusFilter}
                      onChange={setStatusFilter}
                      options={RESERVATION_STATUS_FILTER_OPTIONS}
                      placeholder="All statuses"
                      ariaLabel="Filter reservations by status"
                      fullWidth
                    />
                  </div>

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
                        value={partySizeFilter === "all" ? "0" : String(partySizeFilter)}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPartySizeFilter(value === "0" ? "all" : value);
                        }}
                      />
                      <div className="ownerReservationSliderValue">
                        {formatPartySizeFilterLabel(partySizeFilter)}
                      </div>
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
                      setStatusFilter("all");
                    }}
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    className="btn btn--gold"
                    onClick={() => setFiltersOpen(false)}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </>
          )}

          {visibleReservations.length === 0 ? (
            <EmptyState
              title="No reservations found"
              message="There are no reservations matching the current view and filters."
            />
          ) : (
            <div className="reservationCards">
              {visibleReservations.map((reservation) => {
                const normalizedStatus = formatOwnerReservationStatus(reservation.status);
                const isPending = normalizedStatus === "pending";
                const isAccepted = normalizedStatus === "accepted";
                const isFinished = ["cancelled", "no-show", "completed", "rejected"].includes(normalizedStatus);

                return (
                  <article
                    key={reservation.id}
                    id={`owner-reservation-card-${reservation.id}`}
                    className={`reservationCard ${focusedReservationId === reservation.id ? "reservationCard--focused" : ""}`}
                  >
                    <div className="reservationCard__main">
                      <div>
                        <div className="reservationCard__name">
                          {reservation.customer_name || "Guest"}
                        </div>
                        <div className="reservationCard__meta">
                          {formatDateTime(reservation)} • Party of {reservation.party_size}
                        </div>
                        {reservation.seating_preference ? (
                          <div className="reservationCard__meta">
                            Seating: {reservation.seating_preference}
                          </div>
                        ) : null}
                        {reservation.special_request ? (
                          <div className="reservationCard__meta">
                            Request: {reservation.special_request}
                          </div>
                        ) : null}
                      </div>

                      <span className={toStatusClass(reservation.status)}>
                        {reservation.status}
                      </span>
                    </div>

                    {!isFinished && (
                      <div className="reservationCard__actions">
                        {isPending && (
                          <>
                            <button
                              className="btn btn--gold"
                              type="button"
                              disabled={updatingId === reservation.id}
                              onClick={() => handleAction(reservation.id, "accept")}
                            >
                              {updatingId === reservation.id ? "Working..." : "Accept"}
                            </button>

                            <button
                              className="btn btn--ghost"
                              type="button"
                              disabled={updatingId === reservation.id}
                              onClick={() => setConfirmRejectReservation(reservation)}
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {isAccepted && (
                          <>
                            <button
                              className="btn btn--ghost"
                              type="button"
                              disabled={updatingId === reservation.id}
                              onClick={() => handleAction(reservation.id, "complete")}
                            >
                              Mark completed
                            </button>

                            <button
                              className="btn btn--ghost"
                              type="button"
                              disabled={updatingId === reservation.id}
                              onClick={() => handleAction(reservation.id, "no-show")}
                            >
                              No-show
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSection === "event-attendees" && (
        <div className="ownerReservationPanel">
          <div className="ownerReservationToolbar">
            <div className="ownerReservationTabs">
              <button
                type="button"
                className={`ownerReservationTabs__btn ${eventAttendeesView === "upcoming" ? "is-active" : ""}`}
                onClick={() => setEventAttendeesView("upcoming")}
              >
                Upcoming
              </button>
              <button
                type="button"
                className={`ownerReservationTabs__btn ${eventAttendeesView === "past" ? "is-active" : ""}`}
                onClick={() => setEventAttendeesView("past")}
              >
                Past
              </button>
              <button
                type="button"
                className={`ownerReservationTabs__btn ${eventAttendeesView === "all" ? "is-active" : ""}`}
                onClick={() => setEventAttendeesView("all")}
              >
                All
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                className="themedSelect__control"
                style={{ fontSize: "0.85rem", padding: "6px 10px", borderRadius: 6 }}
                value={eventAttendeesStatusFilter}
                onChange={(e) => setEventAttendeesStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no-show">No-show</option>
              </select>

              <button
                type="button"
                className="btn btn--ghost"
                style={{ fontSize: "0.82rem", padding: "6px 12px" }}
                onClick={loadEventAttendees}
                disabled={eventAttendeesLoading}
              >
                {eventAttendeesLoading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>

          {eventAttendeesError && <div className="fieldError">{eventAttendeesError}</div>}

          {eventAttendeesLoading ? (
            <div className="placeholderPage__text" style={{ padding: "2rem 0" }}>Loading event attendees…</div>
          ) : (() => {
            const now = new Date();
            const filtered = eventAttendees.filter((att) => {
              const eventDate = new Date(att.start_date || att.event_date || "");
              const isUpcoming = !isNaN(eventDate) ? eventDate >= now : true;
              if (eventAttendeesView === "upcoming" && !isUpcoming) return false;
              if (eventAttendeesView === "past" && isUpcoming) return false;
              if (eventAttendeesStatusFilter !== "all" && att.status !== eventAttendeesStatusFilter) return false;
              return true;
            });

            if (!filtered.length) {
              return (
                <EmptyState
                  title="No attendees found"
                  message="No event attendees match the current filters."
                />
              );
            }

            return (
              <div className="reservationCards">
                {filtered.map((att) => {
                  const isConfirmed = att.status === "confirmed";
                  const isNoShow = att.status === "no-show";
                  const eventDateLabel = att.start_date || att.event_date || "";
                  const timeLabel = att.start_time ? att.start_time.slice(0, 5) : "";

                  return (
                    <article key={att.id} className="reservationCard">
                      <div className="reservationCard__main">
                        <div>
                          <div className="reservationCard__name">{att.user_name || "Guest"}</div>
                          <div className="reservationCard__meta">
                            {att.event_title} · {eventDateLabel}{timeLabel ? ` · ${timeLabel}` : ""}
                          </div>
                          <div className="reservationCard__meta">
                            {att.attendees_count} attendee{att.attendees_count !== 1 ? "s" : ""}
                            {att.user_email ? ` · ${att.user_email}` : ""}
                          </div>
                        </div>
                        <span className={`statusBadge statusBadge--${att.status}`}>{att.status}</span>
                      </div>

                      {isConfirmed && (
                        <div className="reservationCard__actions">
                          <button
                            className="btn btn--ghost"
                            type="button"
                            disabled={noShowingAttendeeId === att.id}
                            onClick={() => handleEventAttendeeNoShow(att.id)}
                          >
                            {noShowingAttendeeId === att.id ? "Saving…" : "Mark no-show"}
                          </button>
                        </div>
                      )}

                      {isNoShow && (
                        <div className="reservationCard__actions">
                          <span className="statusBadge statusBadge--no-show">No-show recorded</span>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmRejectReservation)}
        title="Reject reservation?"
        message={
          confirmRejectReservation
            ? `Reject reservation for ${confirmRejectReservation.customer_name || "this guest"}?`
            : ""
        }
        confirmText="Reject"
        cancelText="Cancel"
        destructive
        onConfirm={() => {
          if (confirmRejectReservation?.id) {
            handleAction(confirmRejectReservation.id, "reject");
          }
        }}
        onClose={() => setConfirmRejectReservation(null)}
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
    </div>
  );
}
