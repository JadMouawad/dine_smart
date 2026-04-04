import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getDiscoverFeed } from "../../services/restaurantService";
import { joinEvent, saveEvent } from "../../services/eventService";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { toDateObject, startOfDay, formatDateRange } from "../../utils/dateUtils";
import { getCrowdMeterMeta } from "../../utils/crowdMeter";

function bucketEvents(events = []) {
  const today = startOfDay(new Date());
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
  const [h, m] = String(timeValue).split(":").map((v) => parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return dateOnly;
  const withTime = new Date(dateOnly);
  withTime.setHours(h, m, 0, 0);
  return withTime;
}

function EventCard({ event, onOpenRestaurant, onViewDetails, onJoinEvent }) {
  const eventStart = buildEventDateTime(event.start_date || event.event_date || event.startDate, event.start_time);
  const eventEnd = buildEventDateTime(event.end_date || event.endDate, event.end_time);
  const now = new Date();
  const isEndingSoon = eventEnd ? (eventEnd.getTime() - now.getTime()) <= 48 * 60 * 60 * 1000 : false;
  const isFree = event.is_free === true || event.price === 0 || event.price === "0";
  const isTrending = event.is_trending === true || (event.popularity_score ?? 0) >= 80;
  const distanceLabel = event.distance_km != null ? `${event.distance_km} km away` : "Distance unavailable";
  const goingCount = event.going_count ?? event.attendee_count ?? event.people_going;
  const timeLabel = eventStart
    ? eventStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <article className="discoverEventCard discoverEventCard--rich" key={event.id}>
      <div className="discoverEventCard__header">
        <div>
          <div className="discoverEventCard__title">{event.title}</div>
          <div className="discoverEventCard__restaurant">{event.restaurant_name}</div>
        </div>
        <div className="discoverEventCard__metaChip">{distanceLabel}</div>
      </div>

      <div className="discoverEventCard__dateRow">
        <span>📅 {formatDateRange(event.start_date, event.end_date)}</span>
        {timeLabel && <span>⏰ {timeLabel}</span>}
      </div>

      {event.description && (
        <p className="discoverEventCard__desc discoverEventCard__desc--clamp">
          {event.description}
        </p>
      )}

      <div className="discoverEventCard__tags">
        {isFree && <span className="eventTag">Free</span>}
        {isTrending && <span className="eventTag eventTag--hot">Trending</span>}
        {isEndingSoon && <span className="eventTag eventTag--warn">Ending Soon</span>}
      </div>

      {goingCount != null && (
        <div className="discoverEventCard__social">{goingCount} people going</div>
      )}

      {event.restaurant_id && (
        <div className="discoverEventCard__actions discoverEventCard__actions--dual">
          <button
            className="btn btn--gold discoverEventCard__actionBtn discoverEventCard__actionBtn--primary"
            type="button"
            onClick={() => onJoinEvent?.(event)}
          >
            Join Event
          </button>
          <button
            className="btn btn--ghost discoverEventCard__actionBtn"
            type="button"
            onClick={() => onViewDetails?.(event)}
          >
            View Details
          </button>
        </div>
      )}
    </article>
  );
}

function EventDetailsModal({ event, onClose, onJoin, onSave, onShare }) {
  if (!event) return null;
  const startDate = buildEventDateTime(event.start_date || event.event_date || event.startDate, event.start_time);
  const endDate = buildEventDateTime(event.end_date || event.endDate, event.end_time);
  const timeLabel = startDate
    ? startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  const durationLabel = startDate && endDate
    ? `${Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))) } mins`
    : "Duration varies";
  const distanceLabel = event.distance_km != null ? `${event.distance_km} km away` : "Distance unavailable";
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
            <div className="eventModal__distance">{distanceLabel}</div>
          </div>

          <div className="eventModal__infoRow">
            <span>📅 {formatDateRange(event.start_date, event.end_date)}</span>
            {timeLabel && <span>⏰ {timeLabel}</span>}
            <span>⌛ {durationLabel}</span>
          </div>

          <div className="eventModal__tags">
            {isFree && <span className="eventTag">Free</span>}
            {(event.is_trending || (event.popularity_score ?? 0) >= 80) && <span className="eventTag eventTag--hot">Trending</span>}
            {endDate && (endDate.getTime() - Date.now()) <= 48 * 60 * 60 * 1000 && (
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
  const [activeFilter, setActiveFilter] = useState("all");
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
  const eventBuckets = bucketEvents(feed?.upcoming_events_nearby || []);
  const allEvents = feed?.upcoming_events_nearby || [];
  const featuredEvents = useMemo(() => {
    const sorted = [...allEvents].sort((a, b) => (b.popularity_score ?? 0) - (a.popularity_score ?? 0));
    return sorted.filter((event) => event.is_featured || (event.popularity_score ?? 0) >= 80).slice(0, 8);
  }, [allEvents]);

  const recommendedEvents = useMemo(() => {
    if (feed?.recommended_events?.length) return feed.recommended_events;
    return [...allEvents].slice(0, 6);
  }, [allEvents, feed?.recommended_events]);

  const filteredEvents = useMemo(() => {
    if (activeFilter === "all") return allEvents;
    if (activeFilter === "today") return eventBuckets.today;
    if (activeFilter === "week") return eventBuckets.thisWeek;
    if (activeFilter === "free") return allEvents.filter((event) => event.is_free === true || event.price === 0 || event.price === "0");
    if (activeFilter === "nearby") return allEvents.filter((event) => event.distance_km != null && Number(event.distance_km) <= 5);
    if (activeFilter === "top") return [...allEvents].sort((a, b) => (b.popularity_score ?? 0) - (a.popularity_score ?? 0)).slice(0, 12);
    return allEvents;
  }, [activeFilter, allEvents, eventBuckets.today, eventBuckets.thisWeek]);

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

  async function loadDiscoverFeed() {
    setLoading(true);
    setError("");
    try {
      const data = await getDiscoverFeed({
        latitude: effectiveLatitude,
        longitude: effectiveLongitude,
        distanceRadius: 25,
        limit: 8,
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

  if (loading) {
    return (
      <div className="userSearchPage">
        <h1 className="userSearchPage__title">Discover</h1>
        <LoadingSkeleton variant="card" count={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="userSearchPage">
        <h1 className="userSearchPage__title">Discover</h1>
        <p className="fieldError">{error}</p>
      </div>
    );
  }

  return (
    <div className="userSearchPage">
      <h1 className="userSearchPage__title">Discover</h1>

      <section className="discoverEventsWrap">
        <div className="discoverEventsHeader">
          <h2>Discover Events</h2>
          <p>Hand‑picked experiences near you, with real‑time highlights.</p>
        </div>

        <div className="discoverFilters">
          {[
            { key: "all", label: "All" },
            { key: "today", label: "Today" },
            { key: "week", label: "This Week" },
            { key: "free", label: "Free" },
            { key: "nearby", label: "Nearby" },
            { key: "top", label: "Top Rated" },
          ].map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`filterChip ${activeFilter === filter.key ? "filterChip--on" : ""}`}
              onClick={() => setActiveFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <section className="discoverEventSection">
          <div className="discoverEventSection__title">Featured Events</div>
          <div className="discoverEventsCarousel discoverEventsCarousel--featured">
            {featuredEvents.length ? (
              featuredEvents.map((event) => (
                <EventCard
                  key={`featured-${event.id}`}
                  event={event}
                  onOpenRestaurant={onOpenRestaurant}
                  onViewDetails={(evt) => { setActiveEvent(evt); setDetailsOpen(true); }}
                  onJoinEvent={(evt) => { setActiveEvent(evt); setJoinOpen(true); }}
                />
              ))
            ) : (
              <EmptyState title="No featured events" message="Check back soon for standout experiences." />
            )}
          </div>
        </section>

        <section className="discoverEventSection">
          <div className="discoverEventSection__title">Upcoming Events</div>
          {filteredEvents.length ? (
            <div className="discoverEventsGrid">
              {filteredEvents.map((event) => (
                <EventCard
                  key={`upcoming-${event.id}`}
                  event={event}
                  onOpenRestaurant={onOpenRestaurant}
                  onViewDetails={(evt) => { setActiveEvent(evt); setDetailsOpen(true); }}
                  onJoinEvent={(evt) => { setActiveEvent(evt); setJoinOpen(true); }}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="No upcoming events" message="Try a different filter or check back soon." />
          )}
        </section>

        <section className="discoverEventSection">
          <div className="discoverEventSection__title">Recommended for You</div>
          {recommendedEvents.length ? (
            <div className="discoverEventsGrid">
              {recommendedEvents.map((event) => (
                <EventCard
                  key={`rec-${event.id}`}
                  event={event}
                  onOpenRestaurant={onOpenRestaurant}
                  onViewDetails={(evt) => { setActiveEvent(evt); setDetailsOpen(true); }}
                  onJoinEvent={(evt) => { setActiveEvent(evt); setJoinOpen(true); }}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="No recommendations yet" message="Engage with events to personalize this section." />
          )}
        </section>
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
