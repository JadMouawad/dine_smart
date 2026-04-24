import { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { toast } from "sonner";
import { getReservationAvailability, updateReservation } from "../services/reservationService";
import { getRestaurantById } from "../services/restaurantService";
import ThemedSelect from "./ThemedSelect.jsx";

const PARTY_SIZE_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} ${i + 1 === 1 ? "guest" : "guests"}`,
}));
const SEATING_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "indoor", label: "Indoor" },
  { value: "outdoor", label: "Outdoor" },
];
const DURATION_OPTIONS = [
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours (default)" },
  { value: "150", label: "2.5 hours" },
  { value: "180", label: "3 hours" },
];
const SLOT_STEP_MINUTES = 30;

function pad2(v) {
  return String(v).padStart(2, "0");
}

function parseTimeToMinutes(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function toTimeValue(minutes) {
  const n = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(n / 60))}:${pad2(n % 60)}`;
}

function toLabel(minutes) {
  const n = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(n / 60);
  const min = n % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  const suffix = h24 >= 12 ? "PM" : "AM";
  return `${h12}:${pad2(min)} ${suffix}`;
}

function buildTimeOptions(openingTime, closingTime, durationMinutes = 120) {
  const open = parseTimeToMinutes(openingTime);
  const close = parseTimeToMinutes(closingTime);
  if (open == null || close == null) {
    const fallback = [];
    for (let m = 0; m <= 23 * 60 + 30; m += SLOT_STEP_MINUTES) {
      if (m + durationMinutes > 24 * 60 + 30) break;
      fallback.push({ value: toTimeValue(m), label: toLabel(m) });
    }
    return fallback;
  }
  const end = close >= open ? close : close + 24 * 60;
  const options = [];
  for (let m = open; m <= end && options.length < 48; m += SLOT_STEP_MINUTES) {
    if (m + durationMinutes > end) break;
    options.push({ value: toTimeValue(m), label: toLabel(m) });
  }
  return options;
}

function toDateValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateStr(str) {
  if (!str) return null;
  const d = new Date(`${str}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getDayStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function EditReservationModal({ reservation, onClose, onUpdated }) {
  const restaurantId = reservation?.restaurant_id;

  const [restaurant, setRestaurant] = useState(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(true);

  const initialDate = useMemo(() => parseDateStr(reservation?.reservation_date), [reservation?.reservation_date]);
  const initialTime = useMemo(() => String(reservation?.reservation_time || "").slice(0, 5), [reservation?.reservation_time]);

  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [partySize, setPartySize] = useState(String(reservation?.party_size || "2"));
  const [seatingPreference, setSeatingPreference] = useState(reservation?.seating_preference || "");
  const [specialRequest, setSpecialRequest] = useState(reservation?.special_request || "");
  const [duration, setDuration] = useState(String(reservation?.duration_minutes || "120"));

  const [availabilityInfo, setAvailabilityInfo] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const today = useMemo(() => getDayStart(new Date()), []);
  const selectedDateValue = useMemo(() => toDateValue(date), [date]);

  useEffect(() => {
    if (!restaurantId) return;
    setLoadingRestaurant(true);
    getRestaurantById(restaurantId)
      .then((data) => setRestaurant(data))
      .catch(() => setRestaurant(null))
      .finally(() => setLoadingRestaurant(false));
  }, [restaurantId]);

  const timeOptions = useMemo(
    () => buildTimeOptions(restaurant?.opening_time, restaurant?.closing_time, Number(duration) || 120),
    [restaurant, duration]
  );

  useEffect(() => {
    if (!selectedDateValue || !time) { setAvailabilityInfo(null); return; }
    let cancelled = false;
    setAvailabilityLoading(true);
    getReservationAvailability({
      restaurantId,
      date: selectedDateValue,
      time,
      partySize: Number(partySize) || 2,
      seatingPreference: seatingPreference || null,
      durationMinutes: Number(duration) || 120,
      reservationId: reservation?.id ?? null,
    })
      .then((info) => { if (!cancelled) setAvailabilityInfo(info); })
      .catch(() => { if (!cancelled) setAvailabilityInfo(null); })
      .finally(() => { if (!cancelled) setAvailabilityLoading(false); });
    return () => { cancelled = true; };
  }, [restaurantId, selectedDateValue, time, partySize, seatingPreference, duration]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!date || !time) { setSubmitError("Please select a date and time."); return; }
    setSubmitError("");
    setSubmitting(true);
    try {
      const updated = await updateReservation(reservation.id, {
        date: selectedDateValue,
        time,
        partySize: Number(partySize),
        seatingPreference: seatingPreference || null,
        specialRequest: specialRequest || null,
        durationMinutes: Number(duration) || 120,
      });
      toast.success("Reservation updated. The restaurant will re-confirm it shortly.");
      onUpdated(updated);
      onClose();
    } catch (err) {
      setSubmitError(err.message || "Could not update reservation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal is-open" role="dialog" aria-modal="true" aria-labelledby="edit-res-title">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__panel" role="document">
        <button className="modal__close" aria-label="Close" type="button" onClick={onClose}>✕</button>
        <h2 className="modal__title" id="edit-res-title">Edit Reservation</h2>
        <p className="modal__subtitle">{reservation.restaurant_name}</p>

        {loadingRestaurant ? (
          <p className="reservationHint">Loading restaurant details…</p>
        ) : (
          <form className="form" onSubmit={handleSubmit}>
            <p className="reservationHint" style={{ marginBottom: 12 }}>
              After saving, your reservation returns to <strong>pending</strong> and the restaurant must re-confirm.
            </p>

            <label className="field">
              <span>Select Date</span>
              <DatePicker
                selected={date}
                onChange={(d) => {
                  setDate(d);
                  setTime((prev) => {
                    const opts = buildTimeOptions(restaurant?.opening_time, restaurant?.closing_time, Number(duration) || 120);
                    return opts.some((o) => o.value === prev) ? prev : "";
                  });
                }}
                minDate={today}
                dateFormat="yyyy-MM-dd"
                placeholderText="Choose a date"
                className="input datePickerInput"
                popperPlacement="bottom-start"
                popperClassName="reservationDatePickerPopper"
                calendarClassName="reservationDatePickerCalendar"
              />
            </label>

            <label className="field">
              <span>Duration</span>
              <ThemedSelect
                value={duration}
                onChange={(val) => {
                  const newDur = Number(val) || 120;
                  setDuration(String(val));
                  setTime((prev) => {
                    const opts = buildTimeOptions(restaurant?.opening_time, restaurant?.closing_time, newDur);
                    return opts.some((o) => o.value === prev) ? prev : "";
                  });
                }}
                options={DURATION_OPTIONS}
                ariaLabel="Select reservation duration"
              />
            </label>

            <div className="field">
              <span>Available Times</span>
              {!date ? (
                <div className="reservationHint">Select a date to see available times.</div>
              ) : timeOptions.length === 0 ? (
                <div className="reservationHint">No time slots available for this duration.</div>
              ) : (
                <>
                  {!time && (
                    <div className="reservationHint" style={{ marginBottom: 8, color: "var(--color-gold)" }}>
                      Please select a time slot to continue.
                    </div>
                  )}
                  <div className="reservationTimeGrid">
                    {timeOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`timeSlotBtn ${time === opt.value ? "is-selected" : ""}`}
                        onClick={() => setTime(opt.value)}
                        aria-pressed={time === opt.value}
                      >
                        {time === opt.value && <span className="timeSlotBtn__activeBg" />}
                        <span className="timeSlotBtn__label">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <label className="field">
              <span>Party Size</span>
              <ThemedSelect
                value={partySize}
                onChange={(val) => setPartySize(String(val))}
                options={PARTY_SIZE_OPTIONS}
                ariaLabel="Select party size"
              />
            </label>

            <label className="field">
              <span>Seating Preference (Optional)</span>
              <ThemedSelect
                value={seatingPreference}
                onChange={setSeatingPreference}
                options={SEATING_OPTIONS}
                ariaLabel="Select seating preference"
              />
            </label>

            <label className="field">
              <span>Special Request (Optional)</span>
              <textarea
                className="textarea"
                rows={3}
                value={specialRequest}
                onChange={(e) => setSpecialRequest(e.target.value)}
                placeholder="Allergies, celebration details, or accessibility requests"
              />
            </label>

            {availabilityLoading && (
              <div className="reservationAvailability reservationAvailability--loading">
                Checking availability…
              </div>
            )}
            {!availabilityLoading && availabilityInfo && (
              <div className="reservationAvailability">
                <strong>{availabilityInfo.available_seats} seats</strong> available for this slot.
              </div>
            )}

            {submitError && <div className="fieldError">{submitError}</div>}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn--gold"
                disabled={submitting || !date || !time}
              >
                {submitting ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
