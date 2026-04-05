import React, { useEffect, useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiUsers } from "react-icons/fi";
import ThemedSelect from "./ThemedSelect.jsx";

const STATUS_ORDER = ["pending", "accepted", "rejected", "cancelled", "completed", "no-show"];

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  cancelled: "Cancelled",
  completed: "Completed",
  "no-show": "No-Show",
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function normalizeStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "confirmed") return "accepted";
  return normalized;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toDateTimeValue(reservation) {
  const datePart = String(reservation?.reservation_date || "").trim();
  const timePart = String(reservation?.reservation_time || "00:00:00").slice(0, 8);
  const parsed = new Date(`${datePart}T${timePart}`);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatPanelDate(date) {
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthLabel(date) {
  return date.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
}

function formatTime(reservation) {
  const parsed = toDateTimeValue(reservation);
  if (!parsed) return String(reservation?.reservation_time || "").slice(0, 5);
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getCustomerName(reservation) {
  return String(reservation?.customer_name || "Guest").trim() || "Guest";
}

function getSeatingPreferenceLabel(value) {
  const normalized = String(value || "any").trim().toLowerCase();
  if (normalized === "indoor") return "Indoor";
  if (normalized === "outdoor") return "Outdoor";
  return "Any";
}

function buildMonthCells(anchorDate) {
  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);
  const firstDayOfWeek = monthStart.getDay();
  const totalDays = monthEnd.getDate();

  const cells = Array.from({ length: firstDayOfWeek + totalDays }, (_, index) => {
    if (index < firstDayOfWeek) return null;
    return new Date(anchorDate.getFullYear(), anchorDate.getMonth(), index - firstDayOfWeek + 1);
  });

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function buildMonthWeeks(anchorDate) {
  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);
  const firstDayOfWeek = monthStart.getDay();
  const totalDays = monthEnd.getDate();

  const cells = Array.from({ length: firstDayOfWeek + totalDays }, (_, index) => {
    if (index < firstDayOfWeek) return null;
    return new Date(anchorDate.getFullYear(), anchorDate.getMonth(), index - firstDayOfWeek + 1);
  });

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function formatWeekOptionLabel(weekDays, fallbackIndex) {
  const realDays = weekDays.filter(Boolean);
  if (realDays.length === 0) return `Week ${fallbackIndex + 1}`;

  const first = realDays[0];
  const last = realDays[realDays.length - 1];

  return `${first.getDate()} - ${last.getDate()}`;
}

export default function OwnerReservationCalendar({
  reservations,
  onReservationClick,
}) {
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const [viewMode, setViewMode] = useState("month");
  const [anchorDate, setAnchorDate] = useState(today);
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(today));
  const [statusFilter, setStatusFilter] = useState("all");
  const [userQuery, setUserQuery] = useState("");
  const [yearInput, setYearInput] = useState(String(today.getFullYear()));
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const normalizedUserQuery = userQuery.trim().toLowerCase();

  const reservationsWithMeta = useMemo(() => {
    return (Array.isArray(reservations) ? reservations : [])
      .map((reservation) => {
        const dateValue = toDateTimeValue(reservation);
        if (!dateValue) return null;

        return {
          ...reservation,
          __dateValue: dateValue,
          __dateKey: toDateKey(dateValue),
          __status: normalizeStatus(reservation.status),
          __customerName: getCustomerName(reservation),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.__dateValue.getTime() - b.__dateValue.getTime());
  }, [reservations]);

  const userOptions = useMemo(() => {
    return [...new Set(reservationsWithMeta.map((reservation) => reservation.__customerName))].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [reservationsWithMeta]);

  const monthWeeks = useMemo(() => buildMonthWeeks(anchorDate), [anchorDate]);

  useEffect(() => {
    const safeIndex = Math.min(selectedWeekIndex, Math.max(monthWeeks.length - 1, 0));
    if (safeIndex !== selectedWeekIndex) {
      setSelectedWeekIndex(safeIndex);
    }
  }, [monthWeeks, selectedWeekIndex]);

  useEffect(() => {
    setYearInput(String(anchorDate.getFullYear()));
  }, [anchorDate]);

  useEffect(() => {
    const selectedDate = new Date(selectedDateKey);
    if (
      !Number.isNaN(selectedDate.getTime()) &&
      (selectedDate.getFullYear() !== anchorDate.getFullYear() ||
        selectedDate.getMonth() !== anchorDate.getMonth())
    ) {
      setSelectedDateKey(toDateKey(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)));
    }
  }, [anchorDate, selectedDateKey]);

  const range = useMemo(() => {
    if (viewMode === "week") {
      const weekDays = monthWeeks[selectedWeekIndex] || Array(7).fill(null);
      const realDays = weekDays.filter(Boolean);
      const start = realDays[0] || startOfMonth(anchorDate);
      const end = realDays[realDays.length - 1] || endOfMonth(anchorDate);
      return { days: weekDays, start, end };
    }

    const monthStart = startOfMonth(anchorDate);
    const monthEnd = endOfMonth(anchorDate);
    return { days: buildMonthCells(anchorDate), start: monthStart, end: monthEnd };
  }, [anchorDate, monthWeeks, selectedWeekIndex, viewMode]);

  const userFilteredReservations = useMemo(() => {
    return reservationsWithMeta.filter((reservation) => {
      if (!normalizedUserQuery) return true;
      return reservation.__customerName.toLowerCase().includes(normalizedUserQuery);
    });
  }, [reservationsWithMeta, normalizedUserQuery]);

  const visibleRangeReservations = useMemo(() => {
    const startTime = range.start.getTime();
    const endTime = range.end.getTime();

    return userFilteredReservations.filter((reservation) => {
      const time = reservation.__dateValue.getTime();
      return time >= startTime && time <= endTime;
    });
  }, [range, userFilteredReservations]);

  const legendCounts = useMemo(() => {
    return STATUS_ORDER.reduce((accumulator, status) => {
      accumulator[status] = visibleRangeReservations.filter((reservation) => reservation.__status === status).length;
      return accumulator;
    }, {});
  }, [visibleRangeReservations]);

  const filteredReservations = useMemo(() => {
    return userFilteredReservations.filter((reservation) => {
      if (statusFilter === "all") return true;
      return reservation.__status === statusFilter;
    });
  }, [statusFilter, userFilteredReservations]);

  const reservationsByDate = useMemo(() => {
    const map = new Map();
    filteredReservations.forEach((reservation) => {
      const current = map.get(reservation.__dateKey) || [];
      current.push(reservation);
      map.set(reservation.__dateKey, current);
    });
    return map;
  }, [filteredReservations]);

  useEffect(() => {
    const selectedDate = new Date(selectedDateKey);
    if (Number.isNaN(selectedDate.getTime())) {
      setSelectedDateKey(toDateKey(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)));
      return;
    }

    if (
      selectedDate.getFullYear() !== anchorDate.getFullYear() ||
      selectedDate.getMonth() !== anchorDate.getMonth()
    ) {
      setSelectedDateKey(toDateKey(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)));
    }
  }, [anchorDate, selectedDateKey]);

  const selectedDate = useMemo(() => {
    const [year, month, day] = String(selectedDateKey).split("-").map((value) => parseInt(value, 10));
    const parsed = new Date(year, (month || 1) - 1, day || 1);
    if (Number.isNaN(parsed.getTime())) {
      const fallback = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
      fallback.setHours(0, 0, 0, 0);
      return fallback;
    }
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }, [selectedDateKey, anchorDate]);

  const selectedReservations = useMemo(() => {
    return [...(reservationsByDate.get(selectedDateKey) || [])].sort(
      (a, b) => a.__dateValue.getTime() - b.__dateValue.getTime()
    );
  }, [reservationsByDate, selectedDateKey]);

  function goPrevious() {
    setAnchorDate((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() - 1);
      return new Date(next.getFullYear(), next.getMonth(), 1);
    });
    setSelectedWeekIndex(0);
  }

  function goNext() {
    setAnchorDate((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() + 1);
      return new Date(next.getFullYear(), next.getMonth(), 1);
    });
    setSelectedWeekIndex(0);
  }

  function handleMonthChange(monthIndex) {
    const parsedMonthIndex = parseInt(monthIndex, 10);
    if (Number.isNaN(parsedMonthIndex)) return;

    setAnchorDate((current) => new Date(current.getFullYear(), parsedMonthIndex, 1));
    setSelectedWeekIndex(0);
    setMonthDropdownOpen(false);
  }

  function handleYearChange(event) {
    const nextValue = event.target.value.replace(/[^\d]/g, "");
    setYearInput(nextValue);
  }

  function handleYearBlur() {
    const parsedYear = parseInt(yearInput, 10);
    if (Number.isNaN(parsedYear)) {
      setYearInput(String(anchorDate.getFullYear()));
      return;
    }

    const safeYear = Math.min(Math.max(parsedYear, 1900), 3000);
    setAnchorDate((current) => new Date(safeYear, current.getMonth(), 1));
    setYearInput(String(safeYear));
    setSelectedWeekIndex(0);
  }

  function handleYearKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleYearBlur();
    }
  }

  function handleWeekChange(weekIndex) {
    const nextIndex = parseInt(weekIndex, 10);
    if (Number.isNaN(nextIndex)) return;
    setSelectedWeekIndex(nextIndex);
    setWeekDropdownOpen(false);
  }

  return (
    <section className="ownerCalendarCard formCard">
      <div className="ownerCalendarTopbar">
        <div>
          <h2 className="reservationSection__title">Reservations Calendar</h2>
          <p className="slotAdjustHint">Manage bookings by day, week, or month at a glance.</p>
        </div>

        <div className="ownerCalendarToolbar">
          <div className="ownerCalendarMonthDisplayWrap">
  <div className="ownerCalendarNavGroup--left">
    <button type="button" className="ownerCalendarIconBtn" onClick={goPrevious} aria-label="Previous month">
      <FiChevronLeft />
    </button>
    <button type="button" className="ownerCalendarIconBtn" onClick={goNext} aria-label="Next month">
      <FiChevronRight />
    </button>
  </div>

  <div className="ownerCalendarMonthLabel">{formatMonthLabel(anchorDate)}</div>
</div>

<div className="ownerCalendarToolbar__center">
  <ThemedSelect
    className="ownerCalendarSelect"
    buttonClassName="ownerCalendarMonthSelect"
    value={anchorDate.getMonth()}
    onChange={(nextMonth) => handleMonthChange(Number(nextMonth))}
    options={MONTH_NAMES.map((month, index) => ({ value: index, label: month }))}
    ariaLabel="Select month"
    fullWidth={false}
  />

  <input
    className="ownerCalendarYearInput"
    type="text"
    inputMode="numeric"
    value={yearInput}
    onChange={handleYearChange}
    onBlur={handleYearBlur}
    onKeyDown={handleYearKeyDown}
    aria-label="Enter year"
  />

  {viewMode === "week" && (
    <ThemedSelect
      className="ownerCalendarSelect"
      buttonClassName="ownerCalendarWeekSelect"
      value={selectedWeekIndex}
      onChange={(nextWeek) => handleWeekChange(Number(nextWeek))}
      options={monthWeeks.map((weekDays, index) => ({
        value: index,
        label: `Week ${index + 1} (${formatWeekOptionLabel(weekDays, index)})`,
      }))}
      ariaLabel="Select week"
      fullWidth={false}
    />
  )}
</div>

          <div className="ownerCalendarViewToggle" role="tablist" aria-label="Calendar view mode">
            <button
              type="button"
              className={`ownerCalendarViewToggle__btn ${viewMode === "week" ? "is-active" : ""}`}
              onClick={() => setViewMode("week")}
            >
              Week
            </button>
            <button
              type="button"
              className={`ownerCalendarViewToggle__btn ${viewMode === "month" ? "is-active" : ""}`}
              onClick={() => setViewMode("month")}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      <div className="ownerCalendarLayout">
        <aside className="ownerCalendarSidebar ownerCalendarSidebar--left">
          <div className="ownerCalendarSidebarCard">
            <div className="ownerCalendarLegendList">
              {STATUS_ORDER.map((status) => (
                <div className="ownerCalendarLegendItem" key={status}>
                  <div className="ownerCalendarLegendItem__labelWrap">
                    <span className={`ownerCalendarLegendDot ownerCalendarLegendDot--${status}`} />
                    <span>{STATUS_LABELS[status]}</span>
                  </div>
                  <span className="ownerCalendarLegendCount">{legendCounts[status] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ownerCalendarSidebarCard">
            <div className="ownerCalendarSidebarTitle">Filters</div>

            <label className="field ownerCalendarField">
              <span>Status</span>
              <ThemedSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: "All Statuses" },
                  ...STATUS_ORDER.map((status) => ({
                    value: status,
                    label: STATUS_LABELS[status],
                  })),
                ]}
                placeholder="All Statuses"
                ariaLabel="Filter reservations by status"
              />
            </label>

            <label className="field ownerCalendarField">
              <span>User</span>
              <input
                list="owner-calendar-user-options"
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="All users"
              />
              <datalist id="owner-calendar-user-options">
                {userOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="ownerCalendarHintBox">
            <span className="ownerCalendarHintBox__icon">i</span>
            <span>Click any day to view its reservations, then click a reservation to jump to its action card.</span>
          </div>
        </aside>

        <div className="ownerCalendarGridWrap">
          <div className={`ownerCalendarGrid ownerCalendarGrid--${viewMode}`}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayLabel) => (
              <div key={dayLabel} className="ownerCalendarWeekday">
                {dayLabel}
              </div>
            ))}

            {range.days.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="ownerCalendarDay ownerCalendarDay--empty" />;
              }

              const dayKey = toDateKey(day);
              const dayReservations = reservationsByDate.get(dayKey) || [];
              const isSelected = selectedDateKey === dayKey;
              const isToday = sameDay(day, today);

              return (
                <button
                  key={dayKey}
                  type="button"
                  className={`ownerCalendarDay ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}`}
                  onClick={() => setSelectedDateKey(dayKey)}
                >
                  <div className="ownerCalendarDay__number">{day.getDate()}</div>

                  <div className="ownerCalendarDay__markers">
                    {STATUS_ORDER.map((status) => {
                      const count = dayReservations.filter((reservation) => reservation.__status === status).length;
                      if (!count) return null;

                      return (
                        <div key={`${dayKey}-${status}`} className={`ownerCalendarDayMarker ownerCalendarDayMarker--${status}`}>
                          <span className="ownerCalendarDayMarker__dot" />
                          <span>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="ownerCalendarSidebar ownerCalendarSidebar--right">
          <div className="ownerCalendarSidebarCard ownerCalendarSidebarCard--panel">
            <div className="ownerCalendarPanelHead">
              <div>
                <div className="ownerCalendarPanelDate">{formatPanelDate(selectedDate)}</div>
              </div>
              <div className="ownerCalendarPanelCount">{selectedReservations.length}</div>
            </div>

            <div className="ownerCalendarPanelList">
              {selectedReservations.length === 0 ? (
                <div className="ownerCalendarPanelEmpty">No reservations match your current filters for this day.</div>
              ) : (
                selectedReservations.map((reservation) => (
                  <button
                    type="button"
                    key={reservation.id}
                    className={`ownerCalendarReservationCard ownerCalendarReservationCard--${reservation.__status}`}
                    onClick={() => onReservationClick?.(reservation)}
                  >
                    <div className="ownerCalendarReservationCard__time">{formatTime(reservation)}</div>
                    <div className="ownerCalendarReservationCard__main">
                      <div className="ownerCalendarReservationCard__name">{reservation.__customerName}</div>
                      <div className="ownerCalendarReservationCard__meta">
                        <span className="ownerCalendarReservationCard__metaGroup">
                          <FiUsers />
                          <span>{reservation.party_size}</span>
                        </span>
                      </div>
                      <div className="ownerCalendarReservationCard__party">
                        {getSeatingPreferenceLabel(reservation.seating_preference)}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}