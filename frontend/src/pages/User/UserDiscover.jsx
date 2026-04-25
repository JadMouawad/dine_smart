import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getDiscoverFeed, getPublicEvents } from "../../services/restaurantService";
import { getDiscoverRecommendations } from "../../services/recommendationService";
import { joinEvent, saveEvent } from "../../services/eventService";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import RecommendationCard from "../../components/RecommendationCard.jsx";
import ThemedSelect from "../../components/ThemedSelect.jsx";
import { toDateObject, startOfDay, formatDateRange } from "../../utils/dateUtils";
import { getCrowdMeterMeta } from "../../utils/crowdMeter";

const EVENT_CATEGORY_FILTER_OPTIONS = [
  { value: "upcoming", label: "Upcoming Events" },
  { value: "featured", label: "Featured Events" },
];

const EVENT_DATE_FILTER_OPTIONS = [
  { value: "all", label: "Any Date" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
];

function getEventStartTimestamp(event) {
  const start = buildEventDateTime(
    event?.start_date || event?.event_date || event?.startDate,
    event?.start_time
  );
  return start ? start.getTime() : Number.MAX_SAFE_INTEGER;
}

function mergeEventsById(...eventLists) {
  const merged = new Map();

  eventLists.forEach((list) => {
    if (!Array.isArray(list)) return;

    list.forEach((event) => {
      if (!event) return;
      const key = String(event.id ?? `${event.title || "event"}-${event.start_date || event.event_date || "date"}`);
      const existing = merged.get(key) || {};
      merged.set(key, { ...existing, ...event });
    });
  });

  return Array.from(merged.values()).sort((a, b) => {
    const timeDiff = getEventStartTimestamp(a) - getEventStartTimestamp(b);
    if (timeDiff !== 0) return timeDiff;
    return Number(b.id || 0) - Number(a.id || 0);
  });
}

function bucketEvents(events = [], referenceDate = new Date()) {
  const today = startOfDay(referenceDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  const buckets = {
    today: [],
    thisWeek: [],
    later: [],
  };

  events.forEach((event) => {
    const eventDate = toDateObject(event.start_date || event.event_date || event.end_date);
    if (!eventDate) {
      buckets.later.push(event);
      return;
    }
    const dayDiff = Math.floor((startOfDay(eventDate).getTime() - today.getTime()) / msPerDay);

    if (dayDiff <= 0) {
      buckets.today.push(event);
    } else if (dayDiff <= 7) {
      buckets.thisWeek.push(event);
    } else {
      buckets.later.push(event);
    }
  });

  return buckets;
}

function SectionRestaurants({ title, badge, restaurants, onOpenRestaurant }) {
  if (!restaurants?.length) return null;

  return (
    <section className="discoverFeedSection">
      <div className="discoverFeedSection__header">
        <h2>{title}</h2>
        {badge && <span className="discoverSectionBadge">{badge}</span>}
      </div>
      <div className="restaurantGrid">
        {restaurants.map((restaurant) => (
          (() => {
            const crowd = getCrowdMeterMeta(restaurant);
            return (
          <article
            key={`${title}-${restaurant.id}`}
            className="restaurantCard discoverFeedCard"
            onClick={() => onOpenRestaurant?.(restaurant)}
          >
            <div className="restaurantCard__body">
              <div className="restaurantCard__nameRow">
                <div className="restaurantCard__name">{restaurant.name}</div>
                <div className="restaurantCard__ratingCol">
                  <div className="restaurantCard__rating">Rating {restaurant.rating ?? "N/A"}</div>
                </div>
              </div>
              <div className="restaurantCard__cuisine">{restaurant.cuisine || "Cuisine not set"}</div>
              <div className={`crowdMeter crowdMeter--${crowd.level}`}>
                <span className="crowdMeter__dot" />
                <span>Live Crowd: {crowd.label}{crowd.pct != null ? ` (${crowd.pct}%)` : ""}</span>
              </div>
              <div className="discoverFeedCard__meta">
                {restaurant.distance_km != null ? `${restaurant.distance_km} km away` : "Distance unavailable"}
              </div>
              {(restaurant.active_event_count || 0) > 0 && <div className="discoverFeedCard__badge">{restaurant.active_event_count} event(s)</div>}
            </div>
          </article>
            );
          })()
        ))}
      </div>
    </section>
  );
}

function buildEventDateTime(dateValue, timeValue) {
  const dateOnly = toDateObject(dateValue);
  if (!dateOnly) return null;
  if (!timeValue) return dateOnly;

  const rawTime = String(timeValue).trim();
  const match = rawTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return dateOnly;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3] || "0", 10);
  const meridiem = match[4]?.toUpperCase();

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return dateOnly;
  }

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  const withTime = new Date(dateOnly);
  withTime.setHours(hours, minutes, seconds, 0);
  return withTime;
}

function buildEventEndDateTime(dateValue, timeValue) {
  const endDate = buildEventDateTime(dateValue, timeValue);
  if (!endDate) return null;

  // If the backend only gives an end date without an end time,
  // keep the event visible until the end of that day.
  if (!timeValue) {
    endDate.setHours(23, 59, 59, 999);
  }

  return endDate;
}

function isEventExpired(event, referenceTime = Date.now()) {
  const eventEnd = buildEventEndDateTime(
    event.end_date || event.endDate || event.event_date || event.start_date || event.startDate,
    event.end_time
  );

  if (!eventEnd) return false;
  return eventEnd.getTime() < referenceTime;
}

function getEventCardLabels(event, { isFree, isTrending, isEndingSoon }) {
  const labels = [];
  const addLabel = (value, className = "") => {
    const label = String(value || "").trim();
    if (!label) return;
    const exists = labels.some((item) => item.label.toLowerCase() === label.toLowerCase());
    if (!exists) labels.push({ label, className });
  };

  if (isEndingSoon) addLabel("Ending Soon", "eventSearchCard__tag--warn");
  if (isFree) addLabel("Free", "eventSearchCard__tag--free");
  if (event.is_featured) addLabel("Featured", "eventSearchCard__tag--gold");
  if (isTrending) addLabel("Trending", "eventSearchCard__tag--hot");

  const rawLabels = [event.label, event.tag, event.category, event.event_label, event.eventLabel];
  rawLabels.forEach((label) => addLabel(label, "eventSearchCard__tag--gold"));

  const listLabels = [event.labels, event.tags, event.event_tags, event.eventTags];
  listLabels.forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((item) => {
      if (typeof item === "string") addLabel(item, "eventSearchCard__tag--gold");
      else addLabel(item?.label || item?.name || item?.title, "eventSearchCard__tag--gold");
    });
  });

  return labels;
}

function EventCard({ event, onViewDetails, onJoinEvent }) {
  const eventStart = buildEventDateTime(event.start_date || event.event_date || event.startDate, event.start_time);
  const eventEnd = buildEventEndDateTime(
    event.end_date || event.endDate || event.event_date || event.start_date || event.startDate,
    event.end_time
  );
  const now = new Date();
  const isEndingSoon = eventEnd
    ? eventEnd.getTime() > now.getTime() &&
      eventEnd.getTime() - now.getTime() <= 48 * 60 * 60 * 1000
    : false;
  const isFree = event.is_free === true || event.price === 0 || event.price === "0";
  const isTrending = event.is_trending === true || (event.popularity_score ?? 0) >= 80;
  const timeLabel = eventStart
    ? eventStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "Time TBA";
  const dateLabel = formatDateRange(event.start_date || event.event_date || event.startDate, event.end_date || event.endDate);
  const imageUrl = event.image_url || event.imageUrl || event.cover_url || event.coverUrl || "";
  const labels = getEventCardLabels(event, { isFree, isTrending, isEndingSoon });

  return (
    <article
      className="restaurantCard restaurantCard--search eventSearchCard"
      key={event.id}
      onClick={() => onViewDetails?.(event)}
    >
      <div className="restaurantCard__cover eventSearchCard__cover">
        {imageUrl ? (
          <img
            className="restaurantCard__coverImg"
            src={imageUrl}
            alt={`${event.title || "Event"} cover`}
            loading="lazy"
          />
        ) : (
          <div className="restaurantCard__coverPlaceholder">Event</div>
        )}

        {labels.length > 0 && (
          <div className="eventSearchCard__tags" aria-label="Event labels">
            {labels.map((item) => (
              <span
                key={item.label}
                className={`eventSearchCard__tag ${item.className}`}
              >
                {item.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="restaurantCard__body eventSearchCard__body">
        <div className="restaurantCard__header">
          <div>
            <div className="restaurantCard__name eventSearchCard__title">
              {event.title || "Untitled Event"}
            </div>
            <div className="restaurantCard__cuisine eventSearchCard__restaurant">
              {event.restaurant_name || "Restaurant not set"}
            </div>
          </div>
        </div>

        <p className="eventSearchCard__description">
          {event.description || "No description provided yet."}
        </p>

        <div className="restaurantCard__metaLine eventSearchCard__metaLine">
          📅 {dateLabel || "Date TBA"}
        </div>
        <div className="restaurantCard__metaLine eventSearchCard__metaLine">
          ⏰ {timeLabel}
        </div>

        <div className="restaurantCard__actions eventSearchCard__actions">
          <button
            className="btn btn--gold reserveMiniBtn eventSearchCard__actionBtn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onJoinEvent?.(event);
            }}
          >
            Join Event
          </button>
          <button
            className="btn btn--ghost reserveMiniBtn eventSearchCard__actionBtn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails?.(event);
            }}
          >
            View Details
          </button>
        </div>
      </div>
    </article>
  );
}

function EventDetailsModal({ event, onClose, onJoin, onSave, onShare }) {
  if (!event) return null;
  const startDate = buildEventDateTime(event.start_date || event.event_date || event.startDate, event.start_time);
  const endDate = buildEventEndDateTime(
    event.end_date || event.endDate || event.event_date || event.start_date || event.startDate,
    event.end_time
  );
  const timeLabel = startDate
    ? startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  const durationLabel = startDate && endDate
    ? `${Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))) } mins`
    : "Duration varies";
  const isFree = event.is_free === true || event.price === 0 || event.price === "0";
  const goingCount = event.going_count ?? event.attendee_count ?? event.people_going;
  const mapToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const mapUrl = (event.latitude != null && event.longitude != null && mapToken)
    ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+ffb020(${event.longitude},${event.latitude})/${event.longitude},${event.latitude},13/480x240?access_token=${mapToken}`
    : null;

  return (
    <div className="eventModalOverlay" role="dialog" aria-modal="true">
      <div className="eventModal">
        <button className="eventModal__close" type="button" onClick={onClose} aria-label="Close">×</button>
        <div className="eventModal__media">
          {event.image_url
            ? <img src={event.image_url} alt={event.title || "Event"} />
            : <div className="eventModal__mediaFallback">Event</div>}
        </div>

        <div className="eventModal__content">
          <div className="eventModal__header">
            <div>
              <div className="eventModal__title">{event.title}</div>
              <div className="eventModal__restaurant">{event.restaurant_name}</div>
            </div>
          </div>

          <div className="eventModal__infoRow">
            <span>📅 {formatDateRange(event.start_date, event.end_date)}</span>
            {timeLabel && <span>⏰ {timeLabel}</span>}
            <span>⌛ {durationLabel}</span>
          </div>

          <div className="eventModal__tags">
            {isFree && <span className="eventTag">Free</span>}
            {(event.is_trending || (event.popularity_score ?? 0) >= 80) && <span className="eventTag eventTag--hot">Trending</span>}
            {endDate &&
              endDate.getTime() > Date.now() &&
              endDate.getTime() - Date.now() <= 48 * 60 * 60 * 1000 && (
                <span className="eventTag eventTag--warn">Ending Soon</span>
              )}
          </div>

          {goingCount != null && <div className="eventModal__social">{goingCount} people attending</div>}

          <div className="eventModal__description">
            {event.description || "No description provided yet."}
          </div>

          <div className="eventModal__pricing">
            <div className="eventModal__pricingTitle">Pricing & Rules</div>
            <div>{isFree ? "Free entry" : `Price: ${event.price || "Contact venue"}`}</div>
            <div>{event.rules || "Standard venue policies apply."}</div>
          </div>

          <div className="eventModal__map">
            {mapUrl ? <img src={mapUrl} alt="Event location map" /> : <div className="eventModal__mapFallback">Map preview unavailable</div>}
          </div>

          <div className="eventModal__actions">
            <button className="btn btn--gold" type="button" onClick={() => onJoin(event)}>Join Event</button>
            <button className="btn btn--ghost" type="button" onClick={() => onSave?.(event)}>Save</button>
            <button className="btn btn--ghost" type="button" onClick={() => onShare?.(event)}>Share</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function JoinEventModal({ event, onClose, onConfirm }) {
  const [attendees, setAttendees] = useState(1);
  const [notes, setNotes] = useState("");
  const [seating, setSeating] = useState("Any");
  if (!event) return null;

  return (
    <div className="eventModalOverlay" role="dialog" aria-modal="true">
      <div className="eventModal eventModal--compact">
        <button className="eventModal__close" type="button" onClick={onClose} aria-label="Close">×</button>
        <div className="eventModal__content">
          <div className="eventModal__title">Join {event.title}</div>
          <div className="eventModal__subtitle">{event.restaurant_name}</div>

          <div className="eventFormRow">
            <span>Attendees</span>
            <div className="eventCounter">
              <button type="button" onClick={() => setAttendees((v) => Math.max(1, v - 1))}>−</button>
              <span>{attendees}</span>
              <button type="button" onClick={() => setAttendees((v) => v + 1)}>+</button>
            </div>
          </div>

          <div className="eventFormRow">
            <span>Seating</span>
            <select value={seating} onChange={(e) => setSeating(e.target.value)}>
              <option>Any</option>
              <option>Indoor</option>
              <option>Outdoor</option>
            </select>
          </div>

          <label className="eventFormRow eventFormRow--stack">
            <span>Notes (optional)</span>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <div className="eventModal__actions">
            <button className="btn btn--gold" type="button" onClick={() => onConfirm({ attendees, seating, notes })}>
              Confirm & Join
            </button>
            <button className="btn btn--ghost" type="button" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventSuccessModal({ event, onClose, onViewBooking }) {
  if (!event) return null;
  const startDate = toDateObject(event.start_date || event.event_date || event.startDate);
  const endDate = toDateObject(event.end_date || event.endDate);
  const googleUrl = buildGoogleCalendarUrl(event, startDate, endDate);
  return (
    <div className="eventModalOverlay" role="dialog" aria-modal="true">
      <div className="eventModal eventModal--compact">
        <button className="eventModal__close" type="button" onClick={onClose} aria-label="Close">×</button>
        <div className="eventModal__content eventModal__content--center">
          <div className="eventSuccessIcon">✓</div>
          <div className="eventModal__title">You’re in!</div>
          <div className="eventModal__subtitle">{event.title} • {event.restaurant_name}</div>
          <div className="eventModal__actions eventModal__actions--inline">
            <a className="btn btn--gold" href={googleUrl} target="_blank" rel="noreferrer">Add to Google Calendar</a>
            <button
              className="btn btn--ghost"
              type="button"
              onClick={() => {
                onClose?.();
                onViewBooking?.();
              }}
            >
              View Booking
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildGoogleCalendarUrl(event, startDate, endDate) {
  const title = encodeURIComponent(event.title || "Event");
  const details = encodeURIComponent(event.description || "");
  const location = encodeURIComponent(event.restaurant_name || "");
  const start = formatCalendarDate(startDate);
  const end = formatCalendarDate(endDate || startDate);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${start}/${end}`;
}

function buildIcsDataUrl(event, startDate, endDate) {
  const start = formatCalendarDate(startDate);
  const end = formatCalendarDate(endDate || startDate);
  const uid = `${event.id || Date.now()}@dinesmart`;
  const summary = sanitizeIcs(event.title || "Event");
  const description = sanitizeIcs(event.description || "");
  const location = sanitizeIcs(event.restaurant_name || "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DineSmart//Events//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

function formatCalendarDate(date) {
  if (!date) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}T000000Z`;
}

function sanitizeIcs(value) {
  return String(value).replace(/\n/g, "\\n").replace(/,/g, "\\,");
}

export default function UserDiscover({ onOpenRestaurant, onViewBooking }) {
  const { user } = useAuth();
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [coords, setCoords] = useState({ latitude: null, longitude: null });
  const [publicEvents, setPublicEvents] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState("");
  const [eventFiltersOpen, setEventFiltersOpen] = useState(false);
  const [eventCategoryFilter, setEventCategoryFilter] = useState("upcoming");
  const [eventDateFilter, setEventDateFilter] = useState("all");
  const [eventQuickFilters, setEventQuickFilters] = useState({
    free: false,
    nearby: false,
    top: false,
  });
  const [eventsNow, setEventsNow] = useState(() => Date.now());
  const [activeEvent, setActiveEvent] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const profileLatitude = Number(user?.latitude);
  const profileLongitude = Number(user?.longitude);
  const effectiveLatitude = coords.latitude != null
    ? coords.latitude
    : (Number.isFinite(profileLatitude) ? profileLatitude : null);
  const effectiveLongitude = coords.longitude != null
    ? coords.longitude
    : (Number.isFinite(profileLongitude) ? profileLongitude : null);
  const rawAllEvents = useMemo(
    () => mergeEventsById(feed?.upcoming_events_nearby, publicEvents),
    [feed?.upcoming_events_nearby, publicEvents]
  );
  const allEvents = useMemo(
    () => rawAllEvents.filter((event) => !isEventExpired(event, eventsNow)),
    [rawAllEvents, eventsNow]
  );
  const eventBuckets = useMemo(
    () => bucketEvents(allEvents, new Date(eventsNow)),
    [allEvents, eventsNow]
  );
  const featuredEvents = useMemo(() => {
    const sorted = [...allEvents].sort((a, b) => (b.popularity_score ?? 0) - (a.popularity_score ?? 0));
    return sorted.filter((event) => event.is_featured || (event.popularity_score ?? 0) >= 80).slice(0, 8);
  }, [allEvents]);

  const recommendedEvents = useMemo(() => {
    const activeRecommendedEvents = Array.isArray(feed?.recommended_events)
      ? feed.recommended_events.filter((event) => !isEventExpired(event, eventsNow))
      : [];

    if (activeRecommendedEvents.length) return activeRecommendedEvents;
    return [...allEvents].slice(0, 6);
  }, [allEvents, feed?.recommended_events, eventsNow]);

  const appliedEventFiltersCount = useMemo(() => {
    let count = 0;
    if (eventCategoryFilter !== "upcoming") count += 1;
    if (eventDateFilter !== "all") count += 1;
    if (eventQuickFilters.free) count += 1;
    if (eventQuickFilters.nearby) count += 1;
    if (eventQuickFilters.top) count += 1;
    return count;
  }, [eventCategoryFilter, eventDateFilter, eventQuickFilters]);

  const filteredEvents = useMemo(() => {
    let events = eventCategoryFilter === "featured" ? featuredEvents : allEvents;

    if (eventDateFilter === "today") {
      const todayIds = new Set(eventBuckets.today.map((event) => event.id));
      events = events.filter((event) => todayIds.has(event.id));
    }

    if (eventDateFilter === "week") {
      const weekIds = new Set(eventBuckets.thisWeek.map((event) => event.id));
      events = events.filter((event) => weekIds.has(event.id));
    }

    if (eventQuickFilters.free) {
      events = events.filter(
        (event) =>
          event.is_free === true ||
          event.price === 0 ||
          event.price === "0"
      );
    }

    if (eventQuickFilters.nearby) {
      events = events.filter(
        (event) => event.distance_km != null && Number(event.distance_km) <= 5
      );
    }

    if (eventQuickFilters.top) {
      events = [...events]
        .sort((a, b) => (b.popularity_score ?? 0) - (a.popularity_score ?? 0))
        .slice(0, 12);
    }

    return events;
  }, [
    allEvents,
    featuredEvents,
    eventBuckets.today,
    eventBuckets.thisWeek,
    eventCategoryFilter,
    eventDateFilter,
    eventQuickFilters,
  ]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        });
      },
      () => {
        setCoords({ latitude: null, longitude: null });
      },
      { timeout: 7000 }
    );
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setEventsNow(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  async function loadDiscoverFeed() {
    setLoading(true);
    setError("");
    try {
      const data = await getDiscoverFeed({
        latitude: effectiveLatitude,
        longitude: effectiveLongitude,
        distanceRadius: 25,
        limit: 20,
      });
      setFeed(data);
    } catch (err) {
      setError(err.message || "Failed to load discover feed.");
      setFeed(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadDiscoverFeed();
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveLatitude, effectiveLongitude]);


  useEffect(() => {
    let cancelled = false;

    async function loadPublicEvents() {
      try {
        const data = await getPublicEvents({
          latitude: effectiveLatitude,
          longitude: effectiveLongitude,
          limit: 100,
        });

        if (!cancelled) {
          setPublicEvents(Array.isArray(data) ? data : []);
        }
      } catch (_) {
        if (!cancelled) setPublicEvents([]);
      }
    }

    loadPublicEvents();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      loadPublicEvents();
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [effectiveLatitude, effectiveLongitude]);

  useEffect(() => {
    let cancelled = false;
    setRecommendationsLoading(true);
    setRecommendationsError("");

    getDiscoverRecommendations({
      latitude: effectiveLatitude,
      longitude: effectiveLongitude,
      limit: 6,
    })
      .then((payload) => {
        if (cancelled) return;
        setRecommendations(Array.isArray(payload?.recommendations) ? payload.recommendations : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setRecommendations([]);
        setRecommendationsError(err.message || "Failed to load personalized recommendations.");
      })
      .finally(() => {
        if (!cancelled) setRecommendationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveLatitude, effectiveLongitude]);

  const effectiveRecommendations = recommendations.length
    ? recommendations
    : (Array.isArray(feed?.recommended_for_you) ? feed.recommended_for_you : []);

  if (loading) {
    return (
      <div className="userSearchPage">
        <h1 className="userSearchPage__title">Events</h1>
        <LoadingSkeleton variant="card" count={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="userSearchPage">
        <h1 className="userSearchPage__title">Events</h1>
        <p className="fieldError">{error}</p>
      </div>
    );
  }

  return (
    <div className="userSearchPage">
      <h1 className="userSearchPage__title">Events</h1>

      <section className="discoverEventsWrap">
        <div className="discoverEventsHeader">
          <div className="discoverEventsHeader__top">
            <div>
              <h2>Discover Events</h2>
              <p>Hand‑picked experiences near you, with real‑time highlights.</p>
            </div>

            <button
              type="button"
              className={`searchFilterBtn ${eventFiltersOpen ? "is-active" : ""}`}
              onClick={() => setEventFiltersOpen(true)}
            >
              ⚙ Filters
              {appliedEventFiltersCount > 0 && (
                <span className="searchFilterBtn__badge">
                  {appliedEventFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {eventFiltersOpen && (
          <>
            <div
              className="ownerReservationFiltersBackdrop"
              onClick={() => setEventFiltersOpen(false)}
            />

            <div className="ownerReservationFiltersModal">
              <div className="ownerReservationFiltersModal__head">
                <div className="ownerReservationFiltersModal__title">Event Filters</div>

                <button
                  type="button"
                  className="ownerReservationFiltersModal__close"
                  onClick={() => setEventFiltersOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="ownerReservationFiltersModal__body">
                <div className="ownerReservationFiltersSection">
                  <div className="ownerReservationFiltersSection__title">Event Type</div>

                  <ThemedSelect
                    value={eventCategoryFilter}
                    onChange={setEventCategoryFilter}
                    options={EVENT_CATEGORY_FILTER_OPTIONS}
                    ariaLabel="Filter events by type"
                    fullWidth
                  />
                </div>

                <div className="ownerReservationFiltersSection">
                  <div className="ownerReservationFiltersSection__title">Date</div>

                  <ThemedSelect
                    value={eventDateFilter}
                    onChange={setEventDateFilter}
                    options={EVENT_DATE_FILTER_OPTIONS}
                    ariaLabel="Filter events by date"
                    fullWidth
                  />
                </div>

                <div className="ownerReservationFiltersSection">
                  <div className="ownerReservationFiltersSection__title">Quick Filters</div>

                  <div className="dsCheckboxGrid">
                    {[
                      { key: "free", label: "Free" },
                      { key: "nearby", label: "Nearby" },
                      { key: "top", label: "Top Rated" },
                    ].map((option) => (
                      <label
                        key={option.key}
                        className={`dsCheckOption ${
                          eventQuickFilters[option.key] ? "is-checked" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={eventQuickFilters[option.key]}
                          onChange={(event) =>
                            setEventQuickFilters((prev) => ({
                              ...prev,
                              [option.key]: event.target.checked,
                            }))
                          }
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="ownerReservationFiltersModal__footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setEventCategoryFilter("upcoming");
                    setEventDateFilter("all");
                    setEventQuickFilters({
                      free: false,
                      nearby: false,
                      top: false,
                    });
                  }}
                >
                  Reset
                </button>

                <button
                  type="button"
                  className="btn btn--gold"
                  onClick={() => setEventFiltersOpen(false)}
                >
                  Apply
                </button>
              </div>
            </div>
          </>
        )}

        <section className="discoverEventSection">
          <div className="discoverEventSection__title">
            {eventCategoryFilter === "featured" ? "Featured Events" : "Upcoming Events"}
          </div>

          {filteredEvents.length ? (
            <div className="discoverEventsGrid discoverEventsGrid--restaurantSized">
              {filteredEvents.map((event) => (
                <EventCard
                  key={`filtered-event-${event.id}`}
                  event={event}
                  onOpenRestaurant={onOpenRestaurant}
                  onViewDetails={(evt) => {
                    setActiveEvent(evt);
                    setDetailsOpen(true);
                  }}
                  onJoinEvent={(evt) => {
                    setActiveEvent(evt);
                    setJoinOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No events found"
              message="Try changing your filters or check back soon."
            />
          )}
        </section>

        <section className="discoverEventSection">
          <div className="discoverEventSection__title">Recommended for You</div>

          {recommendedEvents.length ? (
            <div className="discoverEventsGrid discoverEventsGrid--restaurantSized">
              {recommendedEvents.map((event) => (
                <EventCard
                  key={`rec-${event.id}`}
                  event={event}
                  onOpenRestaurant={onOpenRestaurant}
                  onViewDetails={(evt) => {
                    setActiveEvent(evt);
                    setDetailsOpen(true);
                  }}
                  onJoinEvent={(evt) => {
                    setActiveEvent(evt);
                    setJoinOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recommendations yet"
              message="Engage with events to personalize this section."
            />
          )}
        </section>
      </section>

      <section className="discoverFeedSection">
        <div className="discoverFeedSection__header">
          <h2>Recommended for You</h2>
        </div>

        {recommendationsLoading && effectiveRecommendations.length === 0 ? (
          <LoadingSkeleton variant="card" count={3} />
        ) : effectiveRecommendations.length > 0 ? (
          <div className="restaurantGrid">
            {effectiveRecommendations.map((recommendation) => (
              <RecommendationCard
                key={`recommended-${recommendation.id}`}
                recommendation={recommendation}
                onOpenRestaurant={onOpenRestaurant}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No personalized recommendations yet"
            message="Keep exploring restaurants and your recommendations will improve."
          />
        )}

        {recommendationsError && (
          <p className="discoverRecommendations__note">
            {recommendationsError}
          </p>
        )}
      </section>

      {detailsOpen && (
        <EventDetailsModal
          event={activeEvent}
          onClose={() => setDetailsOpen(false)}
          onJoin={(evt) => { setDetailsOpen(false); setActiveEvent(evt); setJoinOpen(true); }}
          onSave={async (evt) => {
            try {
              await saveEvent(evt.id);
              toast.success("Event saved");
            } catch (err) {
              toast.error(err.message || "Failed to save event");
            }
          }}
          onShare={(evt) => {
            const url = `${window.location.origin}/events/${evt.id}`;
            const text = `${evt.title || "Event"} at ${evt.restaurant_name || "DineSmart"}`;
            if (navigator.share) {
              navigator.share({ title: evt.title, text, url }).catch(() => {});
            } else {
              if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(`${text} • ${url}`).then(() => {
                  toast.success("Link copied");
                });
              } else {
                toast.message("Copy this link:", { description: `${text} • ${url}` });
              }
            }
          }}
        />
      )}
      {joinOpen && (
        <JoinEventModal
          event={activeEvent}
          onClose={() => setJoinOpen(false)}
          onConfirm={async (payload) => {
            try {
              await joinEvent(activeEvent?.id, payload);
              setJoinOpen(false);
              setSuccessOpen(true);
              await loadDiscoverFeed();
              toast.success("You're booked!");
            } catch (err) {
              toast.error(err.message || "Failed to join event");
            }
          }}
        />
      )}
      {successOpen && (
        <EventSuccessModal
          event={activeEvent}
          onClose={() => setSuccessOpen(false)}
          onViewBooking={onViewBooking}
        />
      )}
    </div>
  );
}
