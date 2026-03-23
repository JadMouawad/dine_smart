// ── Date utilities shared across UserDiscover, UserReservations ───────────────
import { pad2 } from "./timeUtils";

export function normalizeDateInput(value) {
  if (!value) return "";
  const raw = String(value).trim();
  const directMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch) return directMatch[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

export function toDateObject(dateValue) {
  const normalized = normalizeDateInput(dateValue);
  if (!normalized) return null;
  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return "Dates TBD";
  const start = toDateObject(startDate);
  const end = toDateObject(endDate);
  const startLabel = start ? start.toLocaleDateString() : "";
  const endLabel = end ? end.toLocaleDateString() : "";
  if (startLabel && endLabel && startLabel !== endLabel) return `${startLabel} - ${endLabel}`;
  return startLabel || endLabel || "Dates TBD";
}

/** Parse a reservation row's date + time into a Date object */
export function toReservationDateTime(reservation) {
  const datePart = String(reservation.reservation_date || "").trim();
  const timePart = String(reservation.reservation_time || "00:00:00").slice(0, 8);
  const [hours, minutes, seconds] = timePart.split(":").map((v) => parseInt(v, 10));
  const h = Number.isFinite(hours) ? hours : 0;
  const m = Number.isFinite(minutes) ? minutes : 0;
  const s = Number.isFinite(seconds) ? seconds : 0;

  const dateOnly = datePart.includes("T") ? datePart.slice(0, 10) : datePart;
  const separator = dateOnly.includes("-") ? "-" : dateOnly.includes("/") ? "/" : null;
  if (separator) {
    const rawParts = dateOnly.split(separator).map((v) => parseInt(v, 10));
    if (rawParts.length === 3 && rawParts.every((v) => Number.isFinite(v))) {
      let year, month, day;
      if (String(dateOnly.split(separator)[0]).length === 4) {
        [year, month, day] = rawParts;
      } else if (rawParts[0] > 12) {
        [day, month, year] = rawParts;
      } else {
        [month, day, year] = rawParts;
      }
      return new Date(year, month - 1, day, h, m, s);
    }
  }
  const fallback = new Date(`${datePart} ${timePart}`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function formatReservationDate(reservation) {
  const date = toReservationDateTime(reservation);
  if (!date || Number.isNaN(date.getTime())) return String(reservation?.reservation_date || "");
  return date.toLocaleDateString();
}

export function formatReservationTime(reservation) {
  const date = toReservationDateTime(reservation);
  if (!date || Number.isNaN(date.getTime())) return String(reservation?.reservation_time || "").slice(0, 5);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function toReservationSortTimestamp(reservation, fallback) {
  const date = toReservationDateTime(reservation);
  if (!date || Number.isNaN(date.getTime())) return fallback;
  return date.getTime();
}
