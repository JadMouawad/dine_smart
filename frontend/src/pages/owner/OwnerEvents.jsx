import React, { useEffect, useState } from "react";
import {
  createOwnerEvent,
  deleteOwnerEvent,
  getMyRestaurant,
  getOwnerEventAttendees,
  getOwnerEvents,
  updateOwnerEvent,
} from "../../services/restaurantService";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

const TAG_OPTIONS = ["Free", "Trending", "Ending Soon", "Family", "Live Music", "Outdoor"];

const initialForm = {
  title: "",
  description: "",
  start_date: "",
  end_date: "",
  start_time: "",
  end_time: "",
  max_attendees: "",
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

function buildDateTime(date, time) {
  if (!date || !time) return null;
  const stamp = new Date(`${date}T${time}`);
  return Number.isNaN(stamp.getTime()) ? null : stamp;
}

function getEventStatus(event) {
  const start = buildDateTime(normalizeDateInput(event.start_date), event.start_time || "00:00");
  const end = buildDateTime(normalizeDateInput(event.end_date), event.end_time || "23:59");
  const now = new Date();
  if (start && now < start) return "upcoming";
  if (end && now > end) return "finished";
  return "ongoing";
}

export default function OwnerEvents() {
  const [restaurant, setRestaurant] = useState(null);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingEventId, setEditingEventId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(null);
  const [detailsEvent, setDetailsEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const ownedRestaurant = await getMyRestaurant();
      setRestaurant(ownedRestaurant);
      try {
        const ownerEvents = await getOwnerEvents();
        setEvents(Array.isArray(ownerEvents) ? ownerEvents : []);
      } catch (eventsError) {
        setEvents([]);
        setError(eventsError.message || "Failed to load events.");
      }
    } catch (err) {
      setError(err.message || "Failed to load events.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function startEdit(event) {
    setEditingEventId(event.id);
    setForm({
      title: event.title || "",
      description: event.description || "",
      image_url: event.image_url || "",
      start_date: normalizeDateInput(event.start_date),
      end_date: normalizeDateInput(event.end_date),
      start_time: event.start_time ? String(event.start_time).slice(0, 5) : "",
      end_time: event.end_time ? String(event.end_time).slice(0, 5) : "",
      max_attendees: event.max_attendees ?? "",
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
      if (editingEventId) {
        const updated = await updateOwnerEvent(editingEventId, form);
        setEvents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setSuccess("Event updated.");
      } else {
        const created = await createOwnerEvent({
          restaurant_id: restaurant.id,
          ...form,
        });
        setEvents((prev) => [created, ...prev]);
        setSuccess("Event created.");
      }
      resetForm();
    } catch (err) {
      setError(err.message || "Failed to save event.");
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

  if (loading) {
    return (
      <div className="placeholderPage">
        <h1 className="placeholderPage__title">Events</h1>
        <p className="placeholderPage__text">Loading events...</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="placeholderPage">
        <h1 className="placeholderPage__title">Events</h1>
        <p className="placeholderPage__text">Create your restaurant profile first.</p>
      </div>
    );
  }

  return (
    <div className="ownerTableConfigPage">
      <h1 className="ownerProfile__title">Restaurant Events</h1>
      {error && <div className="fieldError">{error}</div>}
      {success && <div className="inlineToast">{success}</div>}

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
              value={form.start_date}
              onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
              required
            />
          </label>
          <label className="field">
            <span>End Date</span>
            <input
              type="date"
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
              onChange={(e) => setForm((prev) => ({ ...prev, max_attendees: e.target.value }))}
              placeholder="e.g. 30"
            />
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

      <div className="ownerMenuSectionsStack">
        {events.length === 0 ? (
          <div className="menuSectionEmpty">No events created yet.</div>
        ) : (
          events.map((event) => {
            const status = getEventStatus(event);
            return (
              <article className="menuSectionBlock ownerEventCard" key={event.id}>
                <div className="ownerEventCard__header">
                  <div className="ownerEventCard__title">{event.title}</div>
                  <div className="ownerEventCard__actions">
                    <button className="btn btn--ghost" type="button" onClick={() => openDetails(event)}>
                      Details
                    </button>
                    <button className="btn btn--ghost" type="button" onClick={() => startEdit(event)}>
                      Edit
                    </button>
                    <button
                      className="btn btn--ghost"
                      type="button"
                      onClick={() => setConfirmDeleteEvent(event)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="ownerEventCard__meta">
                  <span>⏰ {event.start_time ? String(event.start_time).slice(0, 5) : "--:--"} – {event.end_time ? String(event.end_time).slice(0, 5) : "--:--"}</span>
                  <span>📅 {formatDateLabel(event.start_date)} → {formatDateLabel(event.end_date)}</span>
                  <span>👥 {event.going_count ?? 0}/{event.max_attendees ?? "∞"} attendees</span>
                  <span className={`ownerEventCard__status ownerEventCard__status--${status}`}>{status}</span>
                </div>

                <p className="ownerEventCard__desc">{event.description}</p>
              </article>
            );
          })
        )}
      </div>

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
