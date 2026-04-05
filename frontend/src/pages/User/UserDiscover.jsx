import React, { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getDiscoverFeed } from "../../services/restaurantService";
import { getDiscoverRecommendations } from "../../services/recommendationService";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import RecommendationCard from "../../components/RecommendationCard.jsx";
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

function EventCard({ event, onOpenRestaurant }) {
  return (
    <article className="discoverEventCard" key={event.id}>
      <div className="discoverEventCard__title">{event.title}</div>
      <div className="discoverEventCard__restaurant">{event.restaurant_name}</div>
      <div className="discoverEventCard__date">
        {formatDateRange(event.start_date, event.end_date)}
      </div>
      {event.description && <p className="discoverEventCard__desc">{event.description}</p>}
      {event.restaurant_id && (
        <div className="discoverEventCard__actions">
          <button
            className="btn btn--ghost discoverEventCard__actionBtn"
            type="button"
            onClick={() => onOpenRestaurant?.({ id: event.restaurant_id, name: event.restaurant_name })}
          >
            View Restaurant
          </button>
        </div>
      )}
    </article>
  );
}

export default function UserDiscover({ onOpenRestaurant }) {
  const { user } = useAuth();
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [coords, setCoords] = useState({ latitude: null, longitude: null });
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState("");
  const [recommendationSource, setRecommendationSource] = useState("fallback");
  const profileLatitude = Number(user?.latitude);
  const profileLongitude = Number(user?.longitude);
  const effectiveLatitude = coords.latitude != null
    ? coords.latitude
    : (Number.isFinite(profileLatitude) ? profileLatitude : null);
  const effectiveLongitude = coords.longitude != null
    ? coords.longitude
    : (Number.isFinite(profileLongitude) ? profileLongitude : null);
  const eventBuckets = bucketEvents(feed?.upcoming_events_nearby || []);

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
      latitude: effectiveLatitude,
      longitude: effectiveLongitude,
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
        setRecommendationSource(payload?.source || "fallback");
      })
      .catch((err) => {
        if (cancelled) return;
        setRecommendations([]);
        setRecommendationSource("fallback");
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

      <section className="discoverFeedSection">
        <div className="discoverFeedSection__header">
          <h2>Recommended for You</h2>
          <span className="discoverSectionBadge">
            {recommendationSource === "fallback" ? "Popular fallback" : "Personalized"}
          </span>
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
          <h2>Upcoming Events</h2>
          <span className="discoverSectionBadge">Curated Picks</span>
        </div>
        <div className="discoverEventsBoard">
          {feed?.upcoming_events_nearby?.length ? (
            <>
              {eventBuckets.today.length > 0 && (
                <section className="discoverEventSection">
                  <div className="discoverEventSection__title">Today & Ongoing</div>
                  <div className="discoverEventsCarousel">
                    {eventBuckets.today.map((event) => (
                      <EventCard key={`today-${event.id}`} event={event} onOpenRestaurant={onOpenRestaurant} />
                    ))}
                  </div>
                </section>
              )}

              {eventBuckets.thisWeek.length > 0 && (
                <section className="discoverEventSection">
                  <div className="discoverEventSection__title">This Week</div>
                  <div className="discoverEventsCarousel">
                    {eventBuckets.thisWeek.map((event) => (
                      <EventCard key={`week-${event.id}`} event={event} onOpenRestaurant={onOpenRestaurant} />
                    ))}
                  </div>
                </section>
              )}

              {eventBuckets.later.length > 0 && (
                <section className="discoverEventSection">
                  <div className="discoverEventSection__title">Later</div>
                  <div className="discoverEventsCarousel">
                    {eventBuckets.later.map((event) => (
                      <EventCard key={`later-${event.id}`} event={event} onOpenRestaurant={onOpenRestaurant} />
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <EmptyState title="No upcoming events" message="Check back soon for new promotions and events." />
          )}
        </div>
      </section>
    </div>
  );
}
