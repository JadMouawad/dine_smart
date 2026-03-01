import React, { useEffect, useState } from "react";
import { getDiscoverFeed } from "../../services/restaurantService";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return "Dates TBD";
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T00:00:00`) : null;
  const startLabel = start ? start.toLocaleDateString() : "";
  const endLabel = end ? end.toLocaleDateString() : "";
  if (startLabel && endLabel && startLabel !== endLabel) return `${startLabel} - ${endLabel}`;
  return startLabel || endLabel || "Dates TBD";
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
              {restaurant.distance_km != null && (
                <div className="discoverFeedCard__meta">{restaurant.distance_km} km away</div>
              )}
              {(restaurant.active_event_count || 0) > 0 && <div className="discoverFeedCard__badge">{restaurant.active_event_count} event(s)</div>}
              <div className="discoverFeedCard__meta">
                {(restaurant.rating || 0) >= 4.5 ? "New Restaurant" : "Recommended For You"}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function UserDiscover({ onOpenRestaurant }) {
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [coords, setCoords] = useState({ latitude: null, longitude: null });

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
    let cancelled = false;
    setLoading(true);
    setError("");

    getDiscoverFeed({
      latitude: coords.latitude,
      longitude: coords.longitude,
      distanceRadius: 25,
      limit: 8,
    })
      .then((data) => {
        if (!cancelled) setFeed(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load discover feed.");
          setFeed(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [coords.latitude, coords.longitude]);

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

      <SectionRestaurants
        title="Near You"
        badge="New Restaurant"
        restaurants={feed?.near_you}
        onOpenRestaurant={onOpenRestaurant}
      />

      <SectionRestaurants
        title="Popular Right Now"
        badge="Popular Right Now"
        restaurants={feed?.popular_right_now}
        onOpenRestaurant={onOpenRestaurant}
      />

      <SectionRestaurants
        title="Matches Preferences"
        badge="Recommended For You"
        restaurants={feed?.matches_preferences}
        onOpenRestaurant={onOpenRestaurant}
      />

      <SectionRestaurants
        title="Highly Rated"
        restaurants={feed?.highly_rated}
        onOpenRestaurant={onOpenRestaurant}
      />

      <section className="discoverFeedSection">
        <div className="discoverFeedSection__header">
          <h2>Upcoming Events Nearby</h2>
        </div>
        <div className="discoverEventsCarousel">
          {feed?.upcoming_events_nearby?.length ? (
            feed.upcoming_events_nearby.map((event) => (
              <article className="discoverEventCard" key={event.id}>
                <div className="discoverEventCard__title">{event.title}</div>
                <div className="discoverEventCard__restaurant">{event.restaurant_name}</div>
                <div className="discoverEventCard__date">
                  {formatDateRange(event.start_date, event.end_date)}
                </div>
                {event.description && <p className="discoverEventCard__desc">{event.description}</p>}
              </article>
            ))
          ) : (
            <EmptyState title="No upcoming events nearby" message="Check back soon for new promotions and events." />
          )}
        </div>
      </section>
    </div>
  );
}
