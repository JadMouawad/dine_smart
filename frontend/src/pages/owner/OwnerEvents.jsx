import React, { useEffect, useMemo, useState } from "react";
import {
  createOwnerEvent,
  deleteOwnerEvent,
  deleteOwnerEventReservation,
  getMyRestaurant,
  getOwnerEventAttendees,
  getOwnerEventReservations,
  getOwnerEvents,
  markEventAttendeeNoShow,
  updateOwnerEvent,
} from "../../services/restaurantService";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import ThemedSelect from "../../components/ThemedSelect.jsx";

const TAG_OPTIONS = ["Free", "Trending", "Ending Soon", "Family", "Live Music", "Outdoor"];

const OWNER_EVENTS_SUBTAB_KEY = "ds-owner-events-subtab";
const OWNER_EVENTS_LIST_FILTERS_KEY = "ds-owner-events-list-filters";
const OWNER_EVENT_MANAGE_FILTERS_KEY = "ds-owner-event-manage-filters";

const EVENT_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "upcoming", label: "Upcoming" },
  { value: "ongoing", label: "Ongoing" },
  { value: "finished", label: "Completed" },
];

const EVENT_CREATED_RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Created today" },
  { value: "7d", label: "Created in last 7 days" },
  { value: "30d", label: "Created in last 30 days" },
];

const EVENT_SORT_OPTIONS = [
  { value: "created-desc", label: "Newest first" },
  { value: "created-asc", label: "Oldest first" },
  { value: "start-asc", label: "Starts soonest" },
  { value: "start-desc", label: "Starts latest" },
];

const MANAGE_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
];

const MANAGE_CREATED_RANGE_OPTIONS = [
  { value: "all", label: "All booking dates" },
  { value: "today", label: "Booked today" },
  { value: "7d", label: "Booked in last 7 days" },
  { value: "30d", label: "Booked in last 30 days" },
];

const MANAGE_SORT_OPTIONS = [
  { value: "event-asc", label: "Event date: soonest first" },
  { value: "event-desc", label: "Event date: latest first" },
  { value: "booking-desc", label: "Latest bookings first" },
  { value: "booking-asc", label: "Oldest bookings first" },
];

const initialForm = {
  title: "",
  description: "",
  start_date: "",
  end_date: "",
  start_time: "",
  end_time: "",
  max_attendees: "",
  max_attendees_unlimited: false,
  is_free: true,
  price: "",
  tags: [],
  location_override: "",
  image_url: "",
};

function normalizeDateInput(value) {
  if (!value) return "";
  const raw = String(value).trim();
  const directMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch) return directMatch[1];

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(value) {
  const normalized = normalizeDateInput(value);
  if (!normalized) return "Date unavailable";
  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return normalized;
  return parsed.toLocaleDateString();
}

function formatDateTimeLabel(value) {
  if (!value) return "Date unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return parsed.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTimeLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "--:--";
  const parsed = new Date(`2000-01-01T${raw.slice(0, 8)}`);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 5);
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildDateTime(date, time) {
  if (!date || !time) return null;
  const stamp = new Date(`${date}T${time}`);
  return Number.isNaN(stamp.getTime()) ? null : stamp;
}

function getTodayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEventStatus(event) {
  const start = buildDateTime(normalizeDateInput(event.start_date), event.start_time || "00:00");
  const end = buildDateTime(normalizeDateInput(event.end_date), event.end_time || "23:59");
  const now = new Date();
  if (start && now < start) return "upcoming";
  if (end && now > end) return "finished";
  return "ongoing";
}

function getManageStatusClass(status) {
  if (status === "finished") return "statusBadge statusBadge--completed";
  if (status === "ongoing") return "statusBadge statusBadge--accepted";
  return "statusBadge statusBadge--pending";
}

function getCreatedRangeStart(range) {
  const now = new Date();
  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (range === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (range === "30d") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return null;
}

function matchesCreatedRange(value, range) {
  if (range === "all") return true;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const start = getCreatedRangeStart(range);
  return start ? parsed >= start : true;
}

function sortEventsList(list, sortBy) {
  const items = [...list];

  items.sort((left, right) => {
    const leftCreated = new Date(left.created_at || 0).getTime() || 0;
    const rightCreated = new Date(right.created_at || 0).getTime() || 0;
    const leftStart = buildDateTime(normalizeDateInput(left.start_date), left.start_time || "00:00")?.getTime() ?? 0;
    const rightStart = buildDateTime(normalizeDateInput(right.start_date), right.start_time || "00:00")?.getTime() ?? 0;

    if (sortBy === "created-asc") return leftCreated - rightCreated;
    if (sortBy === "start-asc") return leftStart - rightStart;
    if (sortBy === "start-desc") return rightStart - leftStart;
    return rightCreated - leftCreated;
  });

  return items;
}

function toEventReservationStart(reservation) {
  const datePart = String(reservation?.start_date || reservation?.end_date || "").trim();
  const timePart = String(reservation?.start_time || "00:00:00").slice(0, 8);
  const parsed = new Date(`${datePart}T${timePart}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toEventReservationEnd(reservation) {
  const datePart = String(reservation?.end_date || reservation?.start_date || "").trim();
  const timePart = String(reservation?.end_time || "23:59:59").slice(0, 8);
  const parsed = new Date(`${datePart}T${timePart}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getEventReservationTiming(reservation) {
  const now = new Date();
  const start = toEventReservationStart(reservation);
  const end = toEventReservationEnd(reservation);
  if (start && now < start) return "upcoming";
  if (end && now > end) return "finished";
  return "ongoing";
}

function normalizeEventReservationStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "cancelled" ? "cancelled" : "confirmed";
}

function formatEventReservationDateTime(reservation) {
  const start = toEventReservationStart(reservation);
  if (!start) return "Date/time unavailable";
  return `${start.toLocaleDateString()} at ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function sortManageReservations(list, sortBy) {
  const items = [...list];
  items.sort((left, right) => {
    const leftEvent = toEventReservationStart(left)?.getTime() ?? 0;
    const rightEvent = toEventReservationStart(right)?.getTime() ?? 0;
    const leftBooking = new Date(left.created_at || 0).getTime() || 0;
    const rightBooking = new Date(right.created_at || 0).getTime() || 0;

    if (sortBy === "event-desc") return rightEvent - leftEvent;
    if (sortBy === "booking-desc") return rightBooking - leftBooking;
    if (sortBy === "booking-asc") return leftBooking - rightBooking;
    return leftEvent - rightEvent;
  });
  return items;
}

export default function OwnerEvents() {
  const todayDate = getTodayDateInputValue();
  const [restaurant, setRestaurant] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventReservations, setEventReservations] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingEventId, setEditingEventId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(null);
  const [confirmDeleteEventReservation, setConfirmDeleteEventReservation] = useState(null);
  const [confirmCreateEventImpact, setConfirmCreateEventImpact] = useState(null);
  const [deletingEventReservationId, setDeletingEventReservationId] = useState(null);
  const [detailsEvent, setDetailsEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [noShowingAttendeeId, setNoShowingAttendeeId] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState(() => {
    try {
      return localStorage.getItem(OWNER_EVENTS_SUBTAB_KEY) || "create";
    } catch {
      return "create";
    }
  });
  const [ourEventsFiltersOpen, setOurEventsFiltersOpen] = useState(false);
  const [manageFiltersOpen, setManageFiltersOpen] = useState(false);

  const [eventStatusFilter, setEventStatusFilter] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OWNER_EVENTS_LIST_FILTERS_KEY) || "{}");
      return saved.status || "all";
    } catch {
      return "all";
    }
  });

  const [eventCreatedRange, setEventCreatedRange] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OWNER_EVENTS_LIST_FILTERS_KEY) || "{}");
      return saved.createdRange || "all";
    } catch {
      return "all";
    }
  });

  const [eventSortBy, setEventSortBy] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OWNER_EVENTS_LIST_FILTERS_KEY) || "{}");
      return saved.sortBy || "created-desc";
    } catch {
      return "created-desc";
    }
  });

  const [manageStatusFilter, setManageStatusFilter] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OWNER_EVENT_MANAGE_FILTERS_KEY) || "{}");
      return saved.status || "all";
    } catch {
      return "all";
    }
  });

  const [manageCreatedRange, setManageCreatedRange] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OWNER_EVENT_MANAGE_FILTERS_KEY) || "{}");
      return saved.createdRange || "all";
    } catch {
      return "all";
    }
  });

  const [manageSortBy, setManageSortBy] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OWNER_EVENT_MANAGE_FILTERS_KEY) || "{}");
      return saved.sortBy || "event-asc";
    } catch {
      return "event-asc";
    }
  });

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [restaurantResult, ownerEventsResult, ownerEventReservationsResult] = await Promise.allSettled([
        getMyRestaurant(),
        getOwnerEvents(),
        getOwnerEventReservations(),
      ]);

      setRestaurant(restaurantResult.status === "fulfilled" ? restaurantResult.value : null);
      setEvents(
        ownerEventsResult.status === "fulfilled" && Array.isArray(ownerEventsResult.value)
          ? ownerEventsResult.value
          : []
      );
      setEventReservations(
        ownerEventReservationsResult.status === "fulfilled" && Array.isArray(ownerEventReservationsResult.value)
          ? ownerEventReservationsResult.value
          : []
      );

      if (
        restaurantResult.status === "rejected" &&
        ownerEventsResult.status === "rejected" &&
        ownerEventReservationsResult.status === "rejected"
      ) {
        throw restaurantResult.reason || ownerEventsResult.reason || ownerEventReservationsResult.reason;
      }
    } catch (err) {
      setError(err.message || "Failed to load events.");
      setEvents([]);
      setEventReservations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(OWNER_EVENTS_SUBTAB_KEY, activeSubTab);
    } catch {}
  }, [activeSubTab]);

  useEffect(() => {
    try {
      localStorage.setItem(
        OWNER_EVENTS_LIST_FILTERS_KEY,
        JSON.stringify({
          status: eventStatusFilter,
          createdRange: eventCreatedRange,
          sortBy: eventSortBy,
        })
      );
    } catch {}
  }, [eventStatusFilter, eventCreatedRange, eventSortBy]);

  useEffect(() => {
    try {
      localStorage.setItem(
        OWNER_EVENT_MANAGE_FILTERS_KEY,
        JSON.stringify({
          status: manageStatusFilter,
          createdRange: manageCreatedRange,
          sortBy: manageSortBy,
        })
      );
    } catch {}
  }, [manageStatusFilter, manageCreatedRange, manageSortBy]);

  function startEdit(event) {
    setEditingEventId(event.id);
    setActiveSubTab("create");
    setForm({
      title: event.title || "",
      description: event.description || "",
      image_url: event.image_url || "",
      start_date: normalizeDateInput(event.start_date),
      end_date: normalizeDateInput(event.end_date),
      start_time: event.start_time ? String(event.start_time).slice(0, 5) : "",
      end_time: event.end_time ? String(event.end_time).slice(0, 5) : "",
      max_attendees: event.max_attendees ?? "",
      max_attendees_unlimited: event.max_attendees == null,
      is_free: event.is_free !== false,
      price: event.price ?? "",
      tags: Array.isArray(event.tags) ? event.tags : [],
      location_override: event.location_override || "",
    });
    setSuccess("");
    setError("");
  }

  function resetForm() {
    setEditingEventId(null);
    setForm(initialForm);
  }

  function finishCreatedEvent(created, successMessage = "Event created.") {
    setEvents((prev) => [created, ...prev]);
    setSuccess(successMessage);
    setConfirmCreateEventImpact(null);
    resetForm();
    setActiveSubTab("our-events");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!restaurant?.id) return;

    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!form.description.trim()) {
      setError("Description is required.");
      return;
    }
    if (!form.start_date || !form.end_date) {
      setError("Start and end dates are required.");
      return;
    }
    if (form.start_date < todayDate) {
      setError("Events can only be created for today or a future date.");
      return;
    }
    if (!form.start_time || !form.end_time) {
      setError("Start and end times are required.");
      return;
    }
    const startStamp = buildDateTime(form.start_date, form.start_time);
    const endStamp = buildDateTime(form.end_date, form.end_time);
    if (!startStamp || !endStamp || endStamp <= startStamp) {
      setError("End date/time must be after start date/time.");
      return;
    }
    if (!form.is_free && (!form.price || Number(form.price) <= 0)) {
      setError("Price is required for paid events.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        ...form,
        max_attendees: form.max_attendees_unlimited ? "" : form.max_attendees,
      };
      if (editingEventId) {
        const updated = await updateOwnerEvent(editingEventId, payload);
        setEvents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setSuccess("Event updated.");
      } else {
        const created = await createOwnerEvent({
          restaurant_id: restaurant.id,
          ...payload,
        });
        finishCreatedEvent(created);
      }
    } catch (err) {
      if (!editingEventId && err?.payload?.code === "EVENT_RESERVATION_CONFLICT") {
        setConfirmCreateEventImpact({
          payload: {
            restaurant_id: restaurant.id,
            ...form,
            max_attendees: form.max_attendees_unlimited ? "" : form.max_attendees,
          },
          affectedReservationsCount: Number(err?.payload?.details?.affectedReservationsCount || 0),
        });
      } else {
        setError(err.message || "Failed to save event.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(eventId) {
    setError("");
    setSuccess("");
    try {
      await deleteOwnerEvent(eventId);
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
      setSuccess("Event deleted.");
    } catch (err) {
      setError(err.message || "Failed to delete event.");
    }
  }

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

  async function handleMarkNoShow(attendeeId) {
    if (!detailsEvent) return;
    setNoShowingAttendeeId(attendeeId);
    try {
      await markEventAttendeeNoShow(detailsEvent.id, attendeeId);
      setAttendees((prev) =>
        prev.map((a) => (a.id === attendeeId ? { ...a, status: "no-show" } : a))
      );
    } catch (err) {
      setError(err.message || "Failed to mark no-show.");
    } finally {
      setNoShowingAttendeeId(null);
    }
  }

  async function openDetails(eventItem) {
    setDetailsEvent(eventItem);
    setAttendees([]);
    setAttendeesLoading(true);
    try {
      const data = await getOwnerEventAttendees(eventItem.id);
      setAttendees(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load attendees.");
    } finally {
      setAttendeesLoading(false);
    }
  }

  async function onPickImage(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setError("Please select a valid image (PNG, JPG, JPEG).");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, image_url: String(reader.result || "") }));
    };
    reader.onerror = () => setError("Failed to read image.");
    reader.readAsDataURL(file);
  }

  const filteredEvents = useMemo(() => {
    const filtered = events.filter((event) => {
      const status = getEventStatus(event);
      if (eventStatusFilter !== "all" && status !== eventStatusFilter) return false;
      if (!matchesCreatedRange(event.created_at, eventCreatedRange)) return false;
      return true;
    });

    return sortEventsList(filtered, eventSortBy);
  }, [events, eventStatusFilter, eventCreatedRange, eventSortBy]);

  const filteredManageReservations = useMemo(() => {
    const filtered = eventReservations.filter((reservation) => {
      const reservationStatus = normalizeEventReservationStatus(reservation.status);
      if (manageStatusFilter !== "all" && reservationStatus !== manageStatusFilter) return false;
      if (!matchesCreatedRange(reservation.created_at, manageCreatedRange)) return false;
      return true;
    });

    return sortManageReservations(filtered, manageSortBy);
  }, [eventReservations, manageStatusFilter, manageCreatedRange, manageSortBy]);

  const eventFilterCount = useMemo(() => {
    let count = 0;
    if (eventStatusFilter !== "all") count += 1;
    if (eventCreatedRange !== "all") count += 1;
    if (eventSortBy !== "created-desc") count += 1;
    return count;
  }, [eventStatusFilter, eventCreatedRange, eventSortBy]);

  const manageFilterCount = useMemo(() => {
    let count = 0;
    if (manageStatusFilter !== "all") count += 1;
    if (manageCreatedRange !== "all") count += 1;
    if (manageSortBy !== "event-asc") count += 1;
    return count;
  }, [manageStatusFilter, manageCreatedRange, manageSortBy]);

  if (loading) {
    return (
      <div className="placeholderPage">
        <h1 className="placeholderPage__title">Events</h1>
        <p className="placeholderPage__text">Loading events...</p>
      </div>
    );
  }

  return (
    <div className="ownerTableConfigPage">
      <h1 className="ownerProfile__title">Restaurant Events</h1>
      {error && <div className="fieldError">{error}</div>}
      {success && <div className="inlineToast">{success}</div>}

      <div className="ownerReservationTabs" style={{ marginBottom: 18 }}>
        <button
          type="button"
          className={`ownerReservationTabs__btn ${activeSubTab === "create" ? "is-active" : ""}`}
          onClick={() => setActiveSubTab("create")}
        >
          Create Events
        </button>
        <button
          type="button"
          className={`ownerReservationTabs__btn ${activeSubTab === "our-events" ? "is-active" : ""}`}
          onClick={() => setActiveSubTab("our-events")}
        >
          Our Events
        </button>
        <button
          type="button"
          className={`ownerReservationTabs__btn ${activeSubTab === "manage" ? "is-active" : ""}`}
          onClick={() => setActiveSubTab("manage")}
        >
          Manage Events
        </button>
      </div>

      {activeSubTab === "create" && (
        <form className="formCard ownerTableConfigCard" onSubmit={handleSubmit}>
          <label className="field">
            <span>Event Title</span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
          </label>

          <label className="field">
            <span>Description</span>
            <textarea
              className="textarea"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </label>

          <label className="field">
            <span>Event Image</span>
            <div className="imageCard imageCard--equal ownerEventImageCard">
              <div className="imageCard__preview imageCard__preview--equal ownerEventImagePreview">
                {form.image_url ? (
                  <img className="imageCard__img ownerEventImageImg" src={form.image_url} alt="Event" />
                ) : (
                  <div className="imageCard__placeholder">PNG, JPG, or JPEG</div>
                )}
              </div>
              <label className="btn btn--gold imageCard__btn">
                Upload Image
                <input className="imageCard__input" type="file" accept="image/png, image/jpeg" onChange={onPickImage} />
              </label>
            </div>
          </label>

          <div className="twoCols">
            <label className="field">
              <span>Start Date</span>
              <input
                type="date"
                min={todayDate}
                value={form.start_date}
                onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>End Date</span>
              <input
                type="date"
                min={todayDate}
                value={form.end_date}
                onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
                required
              />
            </label>
          </div>

          <div className="twoCols">
            <label className="field">
              <span>Start Time</span>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>End Time</span>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))}
                required
              />
            </label>
          </div>

          <div className="twoCols ownerEventTwoCols">
            <label className="field">
              <span>Max Attendees</span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.max_attendees}
                onChange={(e) => setForm((prev) => ({ ...prev, max_attendees: e.target.value, max_attendees_unlimited: false }))}
                placeholder={form.max_attendees_unlimited ? "∞" : "e.g. 30"}
                disabled={form.max_attendees_unlimited}
              />
              <label className="ownerEventMaxToggle">
                <input
                  type="checkbox"
                  checked={form.max_attendees_unlimited}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    max_attendees_unlimited: e.target.checked,
                    max_attendees: e.target.checked ? "" : prev.max_attendees,
                  }))}
                />
                Unlimited (∞)
              </label>
            </label>
            <label className="field ownerEventPricingField">
              <span>Pricing</span>
              <div className="ownerEventPricingRow">
                <div className="ownerFilterChipRow ownerEventPricingChips">
                  <button
                    type="button"
                    className={`ownerFilterChip ownerFilterChip--button ${form.is_free ? "is-active" : ""}`}
                    onClick={() => setForm((prev) => ({ ...prev, is_free: true, price: "" }))}
                  >
                    Free
                  </button>
                  <button
                    type="button"
                    className={`ownerFilterChip ownerFilterChip--button ${!form.is_free ? "is-active" : ""}`}
                    onClick={() => setForm((prev) => ({ ...prev, is_free: false }))}
                  >
                    Paid
                  </button>
                </div>
                {!form.is_free && (
                  <input
                    className="ownerEventPriceInput"
                    type="number"
                    min="0"
                    step="1"
                    value={form.price}
                    onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                    placeholder="Price"
                  />
                )}
              </div>
            </label>
          </div>

          <label className="field">
            <span>Tags</span>
            <div className="ownerFilterChipRow ownerEventTagChips">
              {TAG_OPTIONS.map((tag) => {
                const active = form.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`ownerFilterChip ownerFilterChip--button ${active ? "is-active" : ""}`}
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        tags: active ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
                      }));
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </label>

          <label className="field">
            <span>Location</span>
            <input
              type="text"
              value={form.location_override}
              onChange={(e) => setForm((prev) => ({ ...prev, location_override: e.target.value }))}
              placeholder={restaurant.address || "Defaults to restaurant address"}
            />
          </label>

          <div className="formCard__actions ownerEventFormActions">
            <button className="btn btn--gold btn--xl ownerEventActionBtn" type="submit" disabled={saving}>
              {saving ? "Saving..." : editingEventId ? "Update Event" : "Create Event"}
            </button>
            {editingEventId && (
              <button className="btn btn--ghost ownerEventActionBtn" type="button" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      )}

      {activeSubTab === "our-events" && (
        <section className="reservationSection">
          <div className="ownerReservationToolbar">
            <div>
              <h2 className="reservationSection__title">Our Events</h2>
            </div>

            <button
              type="button"
              className={`searchFilterBtn ${ourEventsFiltersOpen ? "is-active" : ""}`}
              onClick={() => setOurEventsFiltersOpen(true)}
            >
              ⚙ Filters
              {eventFilterCount > 0 && (
                <span className="searchFilterBtn__badge">{eventFilterCount}</span>
              )}
            </button>
          </div>

          {ourEventsFiltersOpen && (
            <>
              <button
                type="button"
                className="ownerReservationFiltersBackdrop"
                aria-label="Close event filters"
                onClick={() => setOurEventsFiltersOpen(false)}
              />

              <div className="ownerReservationFiltersModal" role="dialog" aria-modal="true" aria-label="Our events filters">
                <div className="ownerReservationFiltersModal__head">
                  <div className="ownerReservationFiltersModal__title">Filter Our Events</div>
                  <button
                    type="button"
                    className="ownerReservationFiltersModal__close"
                    onClick={() => setOurEventsFiltersOpen(false)}
                    aria-label="Close filters"
                  >
                    ×
                  </button>
                </div>

                <div className="ownerReservationFiltersModal__body">
                  <div className="ownerReservationFiltersSection">
                    <div className="ownerReservationFiltersSection__title">Status</div>
                    <ThemedSelect
                      value={eventStatusFilter}
                      onChange={setEventStatusFilter}
                      options={EVENT_STATUS_OPTIONS}
                      ariaLabel="Filter events by status"
                    />
                  </div>

                  <div className="ownerReservationFiltersSection">
                    <div className="ownerReservationFiltersSection__title">Created date</div>
                    <ThemedSelect
                      value={eventCreatedRange}
                      onChange={setEventCreatedRange}
                      options={EVENT_CREATED_RANGE_OPTIONS}
                      ariaLabel="Filter events by created date"
                    />
                  </div>

                  <div className="ownerReservationFiltersSection">
                    <div className="ownerReservationFiltersSection__title">Sort by</div>
                    <ThemedSelect
                      value={eventSortBy}
                      onChange={setEventSortBy}
                      options={EVENT_SORT_OPTIONS}
                      ariaLabel="Sort events"
                    />
                  </div>
                </div>

                <div className="ownerReservationFiltersModal__footer">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      setEventStatusFilter("all");
                      setEventCreatedRange("all");
                      setEventSortBy("created-desc");
                    }}
                  >
                    Reset
                  </button>

                  <button type="button" className="btn btn--gold" onClick={() => setOurEventsFiltersOpen(false)}>
                    Apply
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="ownerMenuSectionsStack">
            {filteredEvents.length === 0 ? (
              <EmptyState
                title="No events found"
                message="No events match the current filters."
              />
            ) : (
              filteredEvents.map((event) => {
                const status = getEventStatus(event);
                return (
                  <article className="menuSectionBlock ownerEventCard" key={event.id}>
                    <div className="ownerEventCard__header">
                      <div>
                        <div className="ownerEventCard__title">{event.title}</div>
                        <div className="reservationCard__meta" style={{ marginTop: 6 }}>
                          Created {formatDateTimeLabel(event.created_at)}
                        </div>
                      </div>

                      <div className="ownerEventCard__actions">
                        <button className="btn btn--ghost" type="button" onClick={() => openDetails(event)}>
                          Details
                        </button>
                        <button className="btn btn--ghost" type="button" onClick={() => startEdit(event)}>
                          Edit
                        </button>
                        <button className="btn btn--ghost" type="button" onClick={() => setConfirmDeleteEvent(event)}>
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="ownerEventCard__meta">
                      <span>⏰ {formatTimeLabel(event.start_time)} – {formatTimeLabel(event.end_time)}</span>
                      <span>📅 {formatDateLabel(event.start_date)} → {formatDateLabel(event.end_date)}</span>
                      <span>👥 {event.going_count ?? 0}/{event.max_attendees ?? "∞"} attendees</span>
                      <span className={`ownerEventCard__status ownerEventCard__status--${status}`}>{status === "finished" ? "Completed" : status === "ongoing" ? "Ongoing" : "Upcoming"}</span>
                    </div>

                    <p className="ownerEventCard__desc">{event.description}</p>
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      {activeSubTab === "manage" && (
        <section className="reservationSection">
          <div className="ownerReservationToolbar">
            <div>
              <h2 className="reservationSection__title">Manage Events</h2>
            </div>

            <button
              type="button"
              className={`searchFilterBtn ${manageFiltersOpen ? "is-active" : ""}`}
              onClick={() => setManageFiltersOpen(true)}
            >
              ⚙ Filters
              {manageFilterCount > 0 && (
                <span className="searchFilterBtn__badge">{manageFilterCount}</span>
              )}
            </button>
          </div>

          {manageFiltersOpen && (
            <>
              <button
                type="button"
                className="ownerReservationFiltersBackdrop"
                aria-label="Close manage-event filters"
                onClick={() => setManageFiltersOpen(false)}
              />

              <div className="ownerReservationFiltersModal" role="dialog" aria-modal="true" aria-label="Manage event filters">
                <div className="ownerReservationFiltersModal__head">
                  <div className="ownerReservationFiltersModal__title">Filter Event Reservations</div>
                  <button
                    type="button"
                    className="ownerReservationFiltersModal__close"
                    onClick={() => setManageFiltersOpen(false)}
                    aria-label="Close filters"
                  >
                    ×
                  </button>
                </div>

                <div className="ownerReservationFiltersModal__body">
                  <div className="ownerReservationFiltersSection">
                    <div className="ownerReservationFiltersSection__title">Status</div>
                    <ThemedSelect
                      value={manageStatusFilter}
                      onChange={setManageStatusFilter}
                      options={MANAGE_STATUS_OPTIONS}
                      ariaLabel="Filter event reservations by status"
                    />
                  </div>

                  <div className="ownerReservationFiltersSection">
                    <div className="ownerReservationFiltersSection__title">Booked date</div>
                    <ThemedSelect
                      value={manageCreatedRange}
                      onChange={setManageCreatedRange}
                      options={MANAGE_CREATED_RANGE_OPTIONS}
                      ariaLabel="Filter event reservations by booking date"
                    />
                  </div>

                  <div className="ownerReservationFiltersSection">
                    <div className="ownerReservationFiltersSection__title">Sort by</div>
                    <ThemedSelect
                      value={manageSortBy}
                      onChange={setManageSortBy}
                      options={MANAGE_SORT_OPTIONS}
                      ariaLabel="Sort event reservations"
                    />
                  </div>
                </div>

                <div className="ownerReservationFiltersModal__footer">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      setManageStatusFilter("all");
                      setManageCreatedRange("all");
                      setManageSortBy("event-asc");
                    }}
                  >
                    Reset
                  </button>

                  <button type="button" className="btn btn--gold" onClick={() => setManageFiltersOpen(false)}>
                    Apply
                  </button>
                </div>
              </div>
            </>
          )}

          {filteredManageReservations.length === 0 ? (
            <EmptyState
              title="No event reservations"
              message="Event bookings that match your current filters will appear here."
            />
          ) : (
            <div className="reservationCards">
              {filteredManageReservations.map((reservation) => {
                const timing = getEventReservationTiming(reservation);
                const reservationStatus = normalizeEventReservationStatus(reservation.status);
                return (
                  <article className="reservationCard" key={`manage-event-${reservation.id}`}>
                    <div className="reservationCard__main">
                      <div>
                        <div className="reservationCard__name">{reservation.event_title || "Event"}</div>
                        <div className="reservationCard__meta">
                          Guest: {reservation.user_name || "Guest"} • {reservation.attendees_count || 1} attendee(s)
                        </div>
                        <div className="reservationCard__meta">{formatEventReservationDateTime(reservation)}</div>
                        <div className="reservationCard__meta">Booked {formatDateTimeLabel(reservation.created_at)}</div>
                        {reservation.user_email ? (
                          <div className="reservationCard__meta">Email: {reservation.user_email}</div>
                        ) : null}
                      </div>

                      <span className={`statusBadge statusBadge--${reservationStatus === "confirmed" ? "confirmed" : "cancelled"}`}>
                        {reservationStatus === "confirmed" ? "Confirmed" : "Cancelled"}
                      </span>
                    </div>

                    {timing === "finished" && (
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
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        open={!!confirmCreateEventImpact}
        title="Creating this event will impact existing reservations."
        message={
          confirmCreateEventImpact
            ? `All reservations during this time slot will be automatically canceled.\nCustomers will not be able to make reservations during this period.\n\nDo you want to proceed?`
            : ""
        }
        confirmLabel="Yes - create the event and cancel all reservations"
        cancelLabel="No - keep existing reservations"
        busy={saving}
        busyLabel="Creating event..."
        onCancel={() => setConfirmCreateEventImpact(null)}
        onConfirm={async () => {
          if (!confirmCreateEventImpact) return;
          setSaving(true);
          setError("");
          setSuccess("");
          try {
            const created = await createOwnerEvent({
              ...confirmCreateEventImpact.payload,
              confirm_impact: true,
            });
            finishCreatedEvent(
              created,
              "Event created. Existing reservations during this time were cancelled and guests were notified by email."
            );
          } catch (err) {
            setError(err.message || "Failed to save event.");
          } finally {
            setSaving(false);
          }
        }}
      />

      <ConfirmDialog
        open={!!confirmDeleteEvent}
        title="Delete event?"
        message={
          confirmDeleteEvent
            ? `Are you sure you want to delete "${confirmDeleteEvent.title}"?`
            : "Are you sure you want to delete this event?"
        }
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={async () => {
          if (!confirmDeleteEvent) return;
          const id = confirmDeleteEvent.id;
          setConfirmDeleteEvent(null);
          await handleDelete(id);
        }}
        onCancel={() => setConfirmDeleteEvent(null)}
      />

      <ConfirmDialog
        open={!!confirmDeleteEventReservation}
        title="Delete event reservation?"
        message={
          confirmDeleteEventReservation
            ? `Delete the reservation for ${confirmDeleteEventReservation.user_name || "this guest"} from ${confirmDeleteEventReservation.event_title || "this event"}?`
            : "Delete this reservation?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          if (confirmDeleteEventReservation?.id) {
            handleDeleteEventReservation(confirmDeleteEventReservation.id);
          }
        }}
        onCancel={() => setConfirmDeleteEventReservation(null)}
      />

      {detailsEvent && (
        <div className="eventModalOverlay" role="dialog" aria-modal="true">
          <div className="eventModal eventModal--compact">
            <button className="eventModal__close" type="button" onClick={() => setDetailsEvent(null)} aria-label="Close">×</button>
            <div className="eventModal__content">
              <div className="eventModal__title">{detailsEvent.title}</div>
              <div className="eventModal__subtitle">{detailsEvent.restaurant_name}</div>
              <div className="eventModal__description">
                {detailsEvent.going_count ?? 0}/{detailsEvent.max_attendees ?? "∞"} attendees
                {detailsEvent.max_attendees ? (
                  <span> · {Math.max(0, detailsEvent.max_attendees - (detailsEvent.going_count ?? 0))} spots left</span>
                ) : null}
              </div>
              {attendeesLoading ? (
                <div>Loading attendees...</div>
              ) : attendees.length ? (
                <div className="eventAttendeeList">
                  {attendees.map((att) => (
                    <div key={att.id} className="eventAttendeeRow">
                      <div>
                        <div className="eventAttendeeName">{att.full_name || "User"}</div>
                        <div className="eventAttendeeMeta">{att.email || ""}</div>
                      </div>
                      <div className="eventAttendeeCount">{att.attendees_count} people</div>
                      {att.status === "no-show" ? (
                        <span className="statusBadge statusBadge--no-show">No-show</span>
                      ) : att.status === "confirmed" ? (
                        <button
                          className="btn btn--ghost"
                          style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                          disabled={noShowingAttendeeId === att.id}
                          onClick={() => handleMarkNoShow(att.id)}
                        >
                          {noShowingAttendeeId === att.id ? "Saving…" : "Mark no-show"}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div>No attendees yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
