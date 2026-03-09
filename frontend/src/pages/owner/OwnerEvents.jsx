import React, { useEffect, useState } from "react";
import {
  createOwnerEvent,
  deleteOwnerEvent,
  getMyRestaurant,
  getOwnerEvents,
  updateOwnerEvent,
} from "../../services/restaurantService";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

const initialForm = {
  title: "",
  description: "",
  image_url: "",
  start_date: "",
  end_date: "",
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

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [ownedRestaurant, ownerEvents] = await Promise.all([
        getMyRestaurant(),
        getOwnerEvents(),
      ]);
      setRestaurant(ownedRestaurant);
      setEvents(Array.isArray(ownerEvents) ? ownerEvents : []);
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
          <span>Image URL</span>
          <input
            type="url"
            value={form.image_url}
            onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
            placeholder="https://..."
          />
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

        <div className="formCard__actions">
          <button className="btn btn--gold btn--xl" type="submit" disabled={saving}>
            {saving ? "Saving..." : editingEventId ? "UPDATE EVENT" : "CREATE EVENT"}
          </button>
          {editingEventId && (
            <button className="btn btn--ghost" type="button" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <div className="ownerMenuSectionsStack">
        {events.length === 0 ? (
          <div className="menuSectionEmpty">No events created yet.</div>
        ) : (
          events.map((event) => (
            <article className="menuSectionBlock" key={event.id}>
              <div className="menuSectionHeader">
                <button className="btn btn--gold ownerMenuSectionBtn" type="button">
                  {event.title}
                </button>
                <div className="ownerEventActions">
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
              <p>{event.description}</p>
              <p>
                {formatDateLabel(event.start_date)} - {formatDateLabel(event.end_date)}
              </p>
            </article>
          ))
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
    </div>
  );
}
