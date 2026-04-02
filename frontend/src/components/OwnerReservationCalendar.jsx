import React, { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiChevronLeft, FiChevronRight, FiUsers } from "react-icons/fi";

const STATUS_ORDER = ["pending", "accepted", "rejected", "cancelled", "completed", "no-show"];

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  cancelled: "Cancelled",
  completed: "Completed",
  "no-show": "No-Show",
};

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

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfWeek(date) {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
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

function getCalendarRange(anchorDate, viewMode) {
  if (viewMode === "week") {
    const start = startOfWeek(anchorDate);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
    return { days, start, end: endOfWeek(anchorDate) };
  }

  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });

  return { days, start: gridStart, end: monthEnd };
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

  const range = useMemo(() => getCalendarRange(anchorDate, viewMode), [anchorDate, viewMode]);

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
    if (reservationsByDate.has(selectedDateKey)) return;

    if (reservationsByDate.size === 0) {
      setSelectedDateKey(toDateKey(today));
      return;
    }

    const [firstDateKey] = [...reservationsByDate.keys()].sort();
    if (firstDateKey) setSelectedDateKey(firstDateKey);
  }, [reservationsByDate, selectedDateKey, today]);

  const selectedDate = useMemo(() => {
    const [year, month, day] = String(selectedDateKey).split("-").map((value) => parseInt(value, 10));
    const parsed = new Date(year, (month || 1) - 1, day || 1);
    if (Number.isNaN(parsed.getTime())) return today;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }, [selectedDateKey, today]);

  const selectedReservations = useMemo(() => {
    return [...(reservationsByDate.get(selectedDateKey) || [])].sort(
      (a, b) => a.__dateValue.getTime() - b.__dateValue.getTime()
    );
  }, [reservationsByDate, selectedDateKey]);

  function goToday() {
    setAnchorDate(today);
    setSelectedDateKey(toDateKey(today));
  }

  function goPrevious() {
    setAnchorDate((current) => {
      const next = new Date(current);
      if (viewMode === "week") next.setDate(next.getDate() - 7);
      else next.setMonth(next.getMonth() - 1);
      return next;
    });
  }

  function goNext() {
    setAnchorDate((current) => {
      const next = new Date(current);
      if (viewMode === "week") next.setDate(next.getDate() + 7);
      else next.setMonth(next.getMonth() + 1);
      return next;
    });
  }

  return (
    <section className="ownerCalendarCard formCard">
      <div className="ownerCalendarTopbar">
        <div>
          <h2 className="reservationSection__title">Reservations Calendar</h2>
          <p className="slotAdjustHint">Manage bookings by day, week, or month at a glance.</p>
        </div>

        <div className="ownerCalendarToolbar">
          <button type="button" className="ownerCalendarControlBtn" onClick={goToday}>
            Today
          </button>

          <div className="ownerCalendarNavGroup">
            <button type="button" className="ownerCalendarIconBtn" onClick={goPrevious} aria-label="Previous period">
              <FiChevronLeft />
            </button>
            <button type="button" className="ownerCalendarIconBtn" onClick={goNext} aria-label="Next period">
              <FiChevronRight />
            </button>
          </div>

          <div className="ownerCalendarMonthLabel">{formatMonthLabel(anchorDate)}</div>

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

          <button type="button" className="ownerCalendarIconBtn" aria-hidden="true" tabIndex={-1}>
            <FiCalendar />
          </button>
        </div>
      </div>

      <div className="ownerCalendarLayout">
        <aside className="ownerCalendarSidebar ownerCalendarSidebar--left">
          <div className="ownerCalendarSidebarCard">
            <div className="ownerCalendarSidebarTitle">Legend</div>
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
              <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Statuses</option>
                {STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
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

            {range.days.map((day) => {
              const dayKey = toDateKey(day);
              const dayReservations = reservationsByDate.get(dayKey) || [];
              const isSelected = selectedDateKey === dayKey;
              const isToday = sameDay(day, today);
              const isOutsideMonth = viewMode === "month" && day.getMonth() !== anchorDate.getMonth();

              return (
                <button
                  key={dayKey}
                  type="button"
                  className={`ownerCalendarDay ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""} ${isOutsideMonth ? "is-outside" : ""}`}
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
              <div className="ownerCalendarPanelCount">
                {selectedReservations.length} reservation{selectedReservations.length === 1 ? "" : "s"}
              </div>
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
                        <span className={`statusBadge statusBadge--${reservation.__status}`}>
                          {STATUS_LABELS[reservation.__status] || reservation.__status}
                        </span>
                      </div>
                      <div className="ownerCalendarReservationCard__party">Party of {reservation.party_size}</div>
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