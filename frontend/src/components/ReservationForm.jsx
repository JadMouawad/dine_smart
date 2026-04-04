import { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { createReservation, getDisabledReservationSlots, getReservationAvailability } from "../services/reservationService";
import { useAuth } from "../auth/AuthContext";
import ThemedSelect from "./ThemedSelect.jsx";

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

  if (openingMinutes == null || closingMinutes == null) {
    const fallback = [];
    for (let minute = 0; minute <= 23 * 60 + 30; minute += SLOT_STEP_MINUTES) {
      fallback.push({ value: toTimeValue(minute), label: toLabel(minute), nextDay: false });
    }
    return fallback;
  }

  const start = openingMinutes;
  const end = closingMinutes >= openingMinutes ? closingMinutes : closingMinutes + (24 * 60);
  if (end < start) return [];

  const options = [];
  for (let minute = start; minute <= end && options.length < 48; minute += SLOT_STEP_MINUTES) {
    const nextDay = minute >= (24 * 60);
    const label = toLabel(minute) + (nextDay ? " +1" : "");
    options.push({ value: toTimeValue(minute), label, nextDay });
  }
  return options;
}

function isTimeSlotInPast(selectedDate, timeValue, nowMs, nextDay = false) {
  if (!(selectedDate instanceof Date) || Number.isNaN(selectedDate.getTime())) return false;
  const minutes = parseTimeToMinutes(timeValue);
  if (minutes == null) return false;

  const slotDateTime = new Date(selectedDate);
  if (nextDay) slotDateTime.setDate(slotDateTime.getDate() + 1);
  slotDateTime.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return slotDateTime.getTime() <= nowMs;
}


function buildDisabledSlotKey(dateValue, timeValue, seatingPreference = "any") {
  return `${String(dateValue || "").trim()}|${String(timeValue || "").slice(0, 5)}|${String(seatingPreference || "any").trim().toLowerCase() || "any"}`;
}

function addOneDay(dateValue) {
  if (!dateValue) return dateValue;
  const d = new Date(`${dateValue}T00:00:00`);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

export default function ReservationForm({ isOpen, onClose, restaurant, onReserved, inline = false }) {
  const { user } = useAuth();
  const [date, setDate] = useState(null);
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [seatingPreference, setSeatingPreference] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [availabilityInfo, setAvailabilityInfo] = useState(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [suggestedTimes, setSuggestedTimes] = useState([]);
  const [showAllTimes, setShowAllTimes] = useState(false);
  const [disabledSlotKeys, setDisabledSlotKeys] = useState(() => new Set());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [partySizeDropdownOpen, setPartySizeDropdownOpen] = useState(false);
  const [seatingDropdownOpen, setSeatingDropdownOpen] = useState(false);

  const today = useMemo(() => getDayStart(new Date()), []);
  const selectedDateValue = useMemo(() => toDateValue(date), [date]);
  const selectedDateLabel = useMemo(
    () => (date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""),
    [date]
  );
  const bannedUntil = user?.bannedUntil || user?.banned_until || null;
  const noShowCount = user?.noShowCount ?? user?.no_show_count ?? 0;
  const isBanned = useMemo(() => {
    if (!bannedUntil) return false;
    const parsed = new Date(bannedUntil);
    if (Number.isNaN(parsed.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsed.setHours(0, 0, 0, 0);
    return parsed >= today;
  }, [bannedUntil]);
  const bannedLabel = useMemo(() => {
    if (!bannedUntil) return "";
    const parsed = new Date(bannedUntil);
    if (Number.isNaN(parsed.getTime())) return String(bannedUntil);
    return parsed.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }, [bannedUntil]);

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
    setNowMs(Date.now());
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
    setDisabledSlotKeys(new Set());
    setPartySizeDropdownOpen(false);
    setSeatingDropdownOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [isOpen]);

  useEffect(() => {
    if (!date || !time) return;
    const selectedOption = timeOptions.find((o) => o.value === time);
    if (!isTimeSlotInPast(date, time, nowMs, selectedOption?.nextDay ?? false)) return;
    setTime("");
  }, [date, time, nowMs, timeOptions]);


  useEffect(() => {
    if (!isOpen || !restaurant?.id || !selectedDateValue) {
      setDisabledSlotKeys(new Set());
      return;
    }

    const nextDateValue = addOneDay(selectedDateValue);
    let cancelled = false;

    Promise.all([
      getDisabledReservationSlots({ restaurantId: restaurant.id, date: selectedDateValue }).catch(() => []),
      getDisabledReservationSlots({ restaurantId: restaurant.id, date: nextDateValue }).catch(() => []),
    ])
      .then(([sameDaySlots, nextDaySlots]) => {
        if (cancelled) return;
        const nextKeys = new Set();

        [...(Array.isArray(sameDaySlots) ? sameDaySlots : []), ...(Array.isArray(nextDaySlots) ? nextDaySlots : [])].forEach((slot) => {
          const dateValue = String(slot?.reservation_date || "").trim();
          const timeValue = String(slot?.reservation_time || "").slice(0, 5);
          const preference = String(slot?.seating_preference || "any").trim().toLowerCase() || "any";

          if (!dateValue || !timeValue) return;

          nextKeys.add(buildDisabledSlotKey(dateValue, timeValue, preference));
        });

        setDisabledSlotKeys(nextKeys);
      })
      .catch(() => {
        if (!cancelled) setDisabledSlotKeys(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, restaurant?.id, selectedDateValue]);

  useEffect(() => {
    if (!isOpen || !restaurant?.id || !selectedDateValue || !time) {
      setAvailabilityInfo(null);
      setAvailabilityError("");
      setAvailabilityLoading(false);
      return;
    }

    const selectedOption = timeOptions.find((o) => o.value === time);
    const effectiveDate = selectedOption?.nextDay ? addOneDay(selectedDateValue) : selectedDateValue;

    let cancelled = false;
    setAvailabilityLoading(true);
    getReservationAvailability({
      restaurantId: restaurant.id,
      date: effectiveDate,
      time,
      partySize: Number(partySize) || 2,
      seatingPreference: seatingPreference || null,
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
        setAvailabilityError(error.message || "We couldn't check availability. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, partySize, seatingPreference, restaurant?.id, selectedDateValue, time, timeOptions]);

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
    : availabilityInfo?.is_disabled
      ? "Disabled by restaurant"
      : isFullyBooked
        ? "Booked"
        : canAccommodateParty
          ? "Available"
          : "Limited availability";
  const availabilityTimeLabel = time ? toTimeLabel(time) : "";
  const preferenceLabel = seatingPreference ? seatingPreference.charAt(0).toUpperCase() + seatingPreference.slice(1) : "";
  const preferenceAvailableSeats = availabilityInfo?.available_seats_preference;
  const preferenceCapacity = availabilityInfo?.preference_capacity;
  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = {};
    if (!date) nextErrors.date = "Date is required.";
    if (!time) nextErrors.time = "Please choose a time slot.";
    if (!partySize) nextErrors.partySize = "Party size is required.";

    if (date && getDayStart(date) < today) {
      nextErrors.date = "Date cannot be in the past.";
    }

    const selectedOption = timeOptions.find((o) => o.value === time);
    const effectiveDate = selectedOption?.nextDay ? addOneDay(selectedDateValue) : selectedDateValue;

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
        date: effectiveDate,
        time,
        partySize: parsedPartySize,
        seatingPreference: seatingPreference || null,
        specialRequest: specialRequest.trim(),
      });
      onReserved?.({
        ...reservation,
        reservation_date: effectiveDate,
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
        {isBanned && (
          <div className="fieldError">
            You are temporarily banned from booking until {bannedLabel} due to multiple no-shows.
          </div>
        )}
        {!isBanned && noShowCount === 2 && (
          <div className="reservationHint">
            Warning: You have missed 2 reservations. One more may result in a temporary ban.
          </div>
        )}
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
            popperPlacement="bottom-start"
            popperClassName="reservationDatePickerPopper"
            calendarClassName="reservationDatePickerCalendar"
            disabled={isBanned}
            required
          />
        </label>
        {errors.date && <div className="fieldError">{errors.date}</div>}

        <div className="field">
          <span>Available Times</span>
          <div key={selectedDateValue || "empty-date"} className="reservationTimeGrid">
            {visibleTimeOptions.map((option) => {
              const selected = time === option.value;
              const isPastSlot = selectedDateValue ? isTimeSlotInPast(date, option.value, nowMs, option.nextDay ?? false) : false;
              const effectiveDate = option.nextDay ? addOneDay(selectedDateValue) : selectedDateValue;
              const anyKey = buildDisabledSlotKey(effectiveDate, option.value, "any");
              const preferenceKey = seatingPreference
                ? buildDisabledSlotKey(effectiveDate, option.value, seatingPreference)
                : null;
              const isDisabledByOwner = disabledSlotKeys.has(anyKey) || (preferenceKey ? disabledSlotKeys.has(preferenceKey) : false);
              return (
                <button
                  key={option.value}
                  className={`timeSlotBtn ${selected ? "is-selected" : ""} ${(isPastSlot || isDisabledByOwner) ? "is-unavailable" : ""}`}
                  type="button"
                  disabled={!selectedDateValue || isBanned || isPastSlot || isDisabledByOwner}
                  onClick={() => {
                    if (isDisabledByOwner) return;
                    setTime(option.value);
                    setErrors((prev) => ({ ...prev, time: "" }));
                  }}
                  aria-pressed={selected}
                  aria-label={isDisabledByOwner ? `${option.label} disabled by restaurant` : isPastSlot ? `${option.label} unavailable` : option.label}
                  title={isDisabledByOwner ? "Disabled by restaurant" : undefined}
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
          {selectedDateValue && disabledSlotKeys.size > 0 && (
            <div className="reservationHint">Greyed-out time slots are temporarily disabled by the restaurant.</div>
          )}
        </div>
        {errors.time && <div className="fieldError">{errors.time}</div>}

        <label className="field">
          <span>Party Size</span>
          <ThemedSelect
            value={String(partySize)}
            onChange={(nextValue) => setPartySize(String(nextValue))}
            disabled={isBanned}
            options={PARTY_SIZE_OPTIONS.map((size) => ({
              value: String(size),
              label: `${size} ${size === 1 ? "guest" : "guests"}`,
            }))}
            ariaLabel="Select party size"
          />
        </label>
        {errors.partySize && <div className="fieldError">{errors.partySize}</div>}

        <label className="field">
          <span>Seating Preference (Optional)</span>
          <ThemedSelect
            value={seatingPreference}
            onChange={setSeatingPreference}
            disabled={isBanned}
            options={SEATING_OPTIONS}
            placeholder="No preference"
            ariaLabel="Select seating preference"
          />
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
            disabled={isBanned}
          />
        </label>

        {availabilityLoading && (
          <div className="reservationAvailability reservationAvailability--loading">
            Checking availability...
          </div>
        )}

        {availabilityInfo && !availabilityLoading && (
          <div className="reservationAvailability">
            Availability for your selected time
            {selectedDateLabel && availabilityTimeLabel ? ` (${selectedDateLabel} at ${availabilityTimeLabel})` : ""}
            : <strong> {availabilityInfo.available_seats} seats</strong>
            <br />
            Status: <strong>{slotStatusLabel}</strong> | {availabilityInfo.booked_seats} booked / {availabilityInfo.total_capacity} total
            {preferenceLabel && preferenceCapacity != null && preferenceAvailableSeats != null && (
              <>
                <br />
                {preferenceLabel} seating: <strong>{preferenceAvailableSeats}</strong> of {preferenceCapacity} seats remaining
              </>
            )}
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

        {availabilityInfo && isFullyBooked && suggestedTimes.length === 0 && (
          <div className="reservationHint">
            No available slots for this time. Try another date or time.
          </div>
        )}

        {availabilityError && <div className="fieldError">{availabilityError}</div>}
        {errors.submit && <div className="fieldError">{errors.submit}</div>}

        <button className="btn btn--gold btn--xl" type="submit" disabled={submitting || isFullyBooked === true || isBanned || availabilityInfo?.is_disabled === true}>
          {submitting ? "Booking..." : (isBanned ? "BOOKING DISABLED" : (availabilityInfo?.is_disabled ? "SLOT DISABLED" : (isFullyBooked ? "SLOT BOOKED" : "BOOK RESERVATION")))}
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