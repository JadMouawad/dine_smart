import { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { createReservation, getReservationAvailability } from "../services/reservationService";

const PARTY_SIZE_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
const SEATING_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "indoor", label: "Indoor" },
  { value: "outdoor", label: "Outdoor" },
];
const SLOT_STEP_MINUTES = 30;
const DEFAULT_VISIBLE_TIME_SLOTS = 8;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function getDayStart(date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function toDateValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseTimeToMinutes(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return (hours * 60) + minutes;
}

function toTimeValue(minutes) {
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  return `${pad2(Math.floor(normalized / 60))}:${pad2(normalized % 60)}`;
}

function toLabel(minutes) {
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const hour12 = ((hour24 + 11) % 12) + 1;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  return `${hour12}:${pad2(minute)} ${suffix}`;
}

function toTimeLabel(value) {
  const minutes = parseTimeToMinutes(value);
  return minutes == null ? value : toLabel(minutes);
}

function buildTimeOptions(openingTime, closingTime) {
  const openingMinutes = parseTimeToMinutes(openingTime);
  const closingMinutes = parseTimeToMinutes(closingTime);
  const noonMinutes = 12 * 60;

  if (openingMinutes == null || closingMinutes == null) {
    const fallback = [];
    for (let minute = noonMinutes; minute <= 22 * 60; minute += SLOT_STEP_MINUTES) {
      fallback.push({ value: toTimeValue(minute), label: toLabel(minute) });
    }
    return fallback;
  }

  const start = Math.max(openingMinutes, noonMinutes);
  const end = closingMinutes >= openingMinutes ? closingMinutes : closingMinutes + (24 * 60);
  if (end < start) return [];

  const options = [];
  for (let minute = start; minute <= end && options.length < 48; minute += SLOT_STEP_MINUTES) {
    options.push({ value: toTimeValue(minute), label: toLabel(minute) });
  }
  return options;
}

export default function ReservationForm({ isOpen, onClose, restaurant, onReserved, inline = false }) {
  const [date, setDate] = useState(null);
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [seatingPreference, setSeatingPreference] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [availabilityInfo, setAvailabilityInfo] = useState(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const [suggestedTimes, setSuggestedTimes] = useState([]);
  const [showAllTimes, setShowAllTimes] = useState(false);

  const today = useMemo(() => getDayStart(new Date()), []);
  const selectedDateValue = useMemo(() => toDateValue(date), [date]);
  const selectedDateLabel = useMemo(
    () => (date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""),
    [date]
  );

  const timeOptions = useMemo(
    () => buildTimeOptions(restaurant?.opening_time ?? restaurant?.openingTime, restaurant?.closing_time ?? restaurant?.closingTime),
    [restaurant]
  );
  const visibleTimeOptions = useMemo(
    () => (showAllTimes ? timeOptions : timeOptions.slice(0, DEFAULT_VISIBLE_TIME_SLOTS)),
    [showAllTimes, timeOptions]
  );
  const hasMoreTimeOptions = timeOptions.length > DEFAULT_VISIBLE_TIME_SLOTS;

  useEffect(() => {
    if (!isOpen) return;
    setDate(null);
    setTime("");
    setPartySize("2");
    setSeatingPreference("");
    setSpecialRequest("");
    setErrors({});
    setSubmitting(false);
    setAvailabilityInfo(null);
    setAvailabilityError("");
    setSuggestedTimes([]);
    setShowAllTimes(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !restaurant?.id || !selectedDateValue || !time) {
      setAvailabilityInfo(null);
      setAvailabilityError("");
      return;
    }

    let cancelled = false;
    getReservationAvailability({
      restaurantId: restaurant.id,
      date: selectedDateValue,
      time,
      partySize: Number(partySize) || 2,
    })
      .then((info) => {
        if (cancelled) return;
        setAvailabilityInfo(info);
        setSuggestedTimes(Array.isArray(info?.suggested_times) ? info.suggested_times : []);
        setAvailabilityError("");
      })
      .catch((error) => {
        if (cancelled) return;
        setAvailabilityInfo(null);
        setSuggestedTimes([]);
        setAvailabilityError(error.message || "Could not load availability.");
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, partySize, restaurant?.id, selectedDateValue, time]);

  if ((!isOpen && !inline) || !restaurant) return null;

  const normalizedPartySize = Number(partySize) || 2;
  const canAccommodateParty =
    availabilityInfo?.can_accommodate_party
    ?? (availabilityInfo ? Number(availabilityInfo.available_seats || 0) >= normalizedPartySize : null);
  const isFullyBooked =
    availabilityInfo?.is_fully_booked
    ?? (availabilityInfo ? Number(availabilityInfo.available_seats || 0) <= 0 : null);
  const slotStatusLabel = !availabilityInfo
    ? ""
    : isFullyBooked
      ? "Booked"
      : canAccommodateParty
        ? "Available"
        : "Limited availability";
  const availabilityTimeLabel = time ? toTimeLabel(time) : "";

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = {};
    if (!date) nextErrors.date = "Date is required.";
    if (!time) nextErrors.time = "Please choose a time slot.";
    if (!partySize) nextErrors.partySize = "Party size is required.";

    if (date && getDayStart(date) < today) {
      nextErrors.date = "Date cannot be in the past.";
    }

    if (time && !timeOptions.some((option) => option.value === time)) {
      nextErrors.time = "Selected time is outside restaurant hours.";
    }

    const parsedPartySize = Number(partySize);
    if (!Number.isInteger(parsedPartySize) || parsedPartySize < 1 || parsedPartySize > 12) {
      nextErrors.partySize = "Party size must be between 1 and 12.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const reservation = await createReservation({
        restaurantId: restaurant.id,
        date: selectedDateValue,
        time,
        partySize: parsedPartySize,
        seatingPreference: seatingPreference || null,
        specialRequest: specialRequest.trim(),
      });
      onReserved?.({
        ...reservation,
        reservation_date: selectedDateValue,
        reservation_time: `${time}:00`,
      });
      onClose?.();
    } catch (error) {
      setErrors((prev) => ({ ...prev, submit: error.message || "Failed to create reservation." }));
      setSuggestedTimes(Array.isArray(error?.payload?.suggested_times) ? error.payload.suggested_times : []);
    } finally {
      setSubmitting(false);
    }
  }

  const content = (
    <>
      {!inline && (
        <button className="modal__close" aria-label="Close" type="button" onClick={onClose}>
          X
        </button>
      )}

      <h2 className="modal__title">Book Reservation</h2>
      <p className="modal__subtitle">{restaurant.name}</p>

      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Select Date</span>
          <DatePicker
            selected={date}
            onChange={(nextDate) => {
              setDate(nextDate);
              setTime("");
              setShowAllTimes(false);
              setErrors((prev) => ({ ...prev, date: "" }));
            }}
            minDate={today}
            dateFormat="yyyy-MM-dd"
            placeholderText="Choose reservation date"
            className="input datePickerInput"
            required
          />
        </label>
        {errors.date && <div className="fieldError">{errors.date}</div>}

        <div className="field">
          <span>Available Times</span>
          <div key={selectedDateValue || "empty-date"} className="reservationTimeGrid">
            {visibleTimeOptions.map((option) => {
              const selected = time === option.value;
              return (
                <button
                  key={option.value}
                  className={`timeSlotBtn ${selected ? "is-selected" : ""}`}
                  type="button"
                  disabled={!selectedDateValue}
                  onClick={() => {
                    setTime(option.value);
                    setErrors((prev) => ({ ...prev, time: "" }));
                  }}
                  aria-pressed={selected}
                >
                  {selected && <span className="timeSlotBtn__activeBg" />}
                  <span className="timeSlotBtn__label">{option.label}</span>
                </button>
              );
            })}
          </div>
          {selectedDateValue && hasMoreTimeOptions && (
            <button
              type="button"
              className="timeSlotToggleBtn"
              onClick={() => setShowAllTimes((prev) => !prev)}
              aria-expanded={showAllTimes}
            >
              {showAllTimes ? "Show Fewer Times" : "Show More Times"}
            </button>
          )}
          {!selectedDateValue && (
            <div className="reservationHint">Select a date to unlock available time slots.</div>
          )}
          {selectedDateValue && !showAllTimes && hasMoreTimeOptions && (
            <div className="reservationHint">Showing top {DEFAULT_VISIBLE_TIME_SLOTS} available times.</div>
          )}
        </div>
        {errors.time && <div className="fieldError">{errors.time}</div>}

        <label className="field">
          <span>Party Size</span>
          <select className="select" value={partySize} onChange={(e) => setPartySize(e.target.value)} required>
            {PARTY_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} {size === 1 ? "guest" : "guests"}
              </option>
            ))}
          </select>
        </label>
        {errors.partySize && <div className="fieldError">{errors.partySize}</div>}

        <label className="field">
          <span>Seating Preference (Optional)</span>
          <select className="select" value={seatingPreference} onChange={(e) => setSeatingPreference(e.target.value)}>
            {SEATING_OPTIONS.map((option) => (
              <option key={option.value || "any"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Special Request (Optional)</span>
          <textarea
            className="textarea"
            value={specialRequest}
            onChange={(e) => setSpecialRequest(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Allergies, celebration details, or accessibility requests"
          />
        </label>

        {availabilityInfo && (
          <div className="reservationAvailability">
            Availability for your selected time
            {selectedDateLabel && availabilityTimeLabel ? ` (${selectedDateLabel} at ${availabilityTimeLabel})` : ""}
            : <strong> {availabilityInfo.available_seats} seats</strong>
            <br />
            Status: <strong>{slotStatusLabel}</strong> | {availabilityInfo.booked_seats} booked / {availabilityInfo.total_capacity} total
          </div>
        )}

        {suggestedTimes.length > 0 && (
          <div className="reservationAvailability reservationAvailability--suggested">
            <div>Suggested times:</div>
            <div className="reservationSuggestedTimes">
              {suggestedTimes.map((suggested) => {
                const value = String(suggested).slice(0, 5);
                const selected = value === time;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`suggestedTimeBtn ${selected ? "is-selected" : ""}`}
                    onClick={() => setTime(value)}
                  >
                    {toTimeLabel(value)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {availabilityError && <div className="fieldError">{availabilityError}</div>}
        {errors.submit && <div className="fieldError">{errors.submit}</div>}

        <button className="btn btn--gold btn--xl" type="submit" disabled={submitting || isFullyBooked === true}>
          {submitting ? "Booking..." : (isFullyBooked ? "SLOT BOOKED" : "BOOK RESERVATION")}
        </button>
      </form>
    </>
  );

  if (inline) {
    return <div className="formCard reservationInlineForm">{content}</div>;
  }

  return (
    <div className="modal is-open" aria-hidden="false" role="dialog" aria-modal="true">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__panel reservationModal" role="document">
        {content}
      </div>
    </div>
  );
}
