// ── Time utilities shared across UserSearch, SearchFilterDrawer,
//    RestaurantDetailPanel, ReservationForm ──────────────────────────────────

export function pad2(v) {
  return String(v).padStart(2, "0");
}

export function getTodayDateValue() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function getCurrentSlotParams() {
  const now = new Date();
  const roundedMinutes = Math.ceil(now.getMinutes() / 15) * 15;
  if (roundedMinutes >= 60) {
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
  } else {
    now.setMinutes(roundedMinutes);
  }
  now.setSeconds(0, 0);
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  return { date, time };
}

export function toMinutesOfDay(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function isOpenNow(openingTime, closingTime) {
  const open = toMinutesOfDay(openingTime);
  const close = toMinutesOfDay(closingTime);
  if (open == null || close == null) return false;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  if (close >= open) return current >= open && current <= close;
  return current >= open || current <= close;
}

/** Formats a "HH:MM" string to "H:MM AM/PM" */
export function formatTimeLabel(timeValue) {
  const [rawHour = "0", rawMinute = "00"] = String(timeValue || "").split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return String(timeValue || "");
  const hour12 = ((hour + 11) % 12) + 1;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour12}:${pad2(minute)} ${suffix}`;
}
