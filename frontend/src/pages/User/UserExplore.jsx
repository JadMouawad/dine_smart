import React, { useEffect, useMemo, useRef, useState } from "react";
import { searchRestaurants } from "../../services/restaurantService";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";

const CUISINES = [
  "All",
  "American",
  "Middle Eastern",
  "French",
  "Mexican",
  "Chinese",
  "Japanese",
  "Italian",
  "Indian",
  "International",
];

const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Halal", "GF"];
const PRICE_OPTIONS = ["$", "$$", "$$$", "$$$$"];

const defaultFilters = {
  minRating: 1,
  distanceRadius: 10,
  priceRange: [],
  dietarySupport: [],
  openNow: false,
  verifiedOnly: true,
};

export default function UserExplore({ onOpenRestaurant }) {
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState("All");
  const [filters, setFilters] = useState(defaultFilters);
  const [coords, setCoords] = useState({ latitude: null, longitude: null, status: "idle" });
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [hoveredRestaurantId, setHoveredRestaurantId] = useState(null);
  const listContainerRef = useRef(null);
  const listItemRefs = useRef({});

  useEffect(() => {
    if (!navigator.geolocation) {
      setCoords({ latitude: null, longitude: null, status: "unsupported" });
      return;
    }

    setCoords((prev) => ({ ...prev, status: "requesting" }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          status: "granted",
        });
      },
      () => {
        setCoords({ latitude: null, longitude: null, status: "denied" });
      },
      { timeout: 7000 }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    searchRestaurants(query, cuisine, {
      ...filters,
      latitude: coords.latitude,
      longitude: coords.longitude,
      distanceRadius: coords.latitude != null && coords.longitude != null ? filters.distanceRadius : null,
    })
      .then((data) => {
        if (cancelled) return;
        setRestaurants(Array.isArray(data) ? data : []);
        if (!selectedRestaurantId && data?.length) {
          setSelectedRestaurantId(data[0].id);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRestaurants([]);
          setError(err.message || "Failed to load map results.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, cuisine, filters, coords.latitude, coords.longitude, selectedRestaurantId]);

  const restaurantsWithCoords = useMemo(
    () =>
      restaurants.filter(
        (restaurant) => restaurant.latitude != null && restaurant.longitude != null
      ),
    [restaurants]
  );

  const bounds = useMemo(() => {
    if (!restaurantsWithCoords.length) return null;
    const latitudes = restaurantsWithCoords.map((restaurant) => Number(restaurant.latitude));
    const longitudes = restaurantsWithCoords.map((restaurant) => Number(restaurant.longitude));
    return {
      minLat: Math.min(...latitudes),
      maxLat: Math.max(...latitudes),
      minLng: Math.min(...longitudes),
      maxLng: Math.max(...longitudes),
    };
  }, [restaurantsWithCoords]);

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) || null,
    [restaurants, selectedRestaurantId]
  );

  const markerPosition = (restaurant) => {
    if (!bounds) return { left: "50%", top: "50%" };
    const lat = Number(restaurant.latitude);
    const lng = Number(restaurant.longitude);
    const latSpan = bounds.maxLat - bounds.minLat || 1;
    const lngSpan = bounds.maxLng - bounds.minLng || 1;
    const left = ((lng - bounds.minLng) / lngSpan) * 100;
    const top = 100 - ((lat - bounds.minLat) / latSpan) * 100;
    return {
      left: `${Math.min(95, Math.max(5, left))}%`,
      top: `${Math.min(95, Math.max(5, top))}%`,
    };
  };

  const focusRestaurantFromMap = (restaurantId) => {
    setSelectedRestaurantId(restaurantId);
    const target = listItemRefs.current[restaurantId];
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const toggleArrayFilter = (key, value) => {
    setFilters((prev) => {
      const existing = prev[key] || [];
      const next = existing.includes(value)
        ? existing.filter((item) => item !== value)
        : [...existing, value];
      return { ...prev, [key]: next };
    });
  };

  return (
    <div className="userSearchPage">
      <h1 className="userSearchPage__title">Explore Map</h1>

      <div className="advancedFiltersPanel">
        <input
          className="searchInput"
          type="text"
          placeholder="Search restaurants..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search restaurants on map"
        />
        <select
          className="select searchCuisineSelect"
          value={cuisine}
          onChange={(event) => setCuisine(event.target.value)}
          aria-label="Filter by cuisine"
        >
          {CUISINES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <div className="advancedFiltersRow">
          <label className="field">
            <span>Min Rating: {filters.minRating}</span>
            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              value={filters.minRating}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, minRating: Number(event.target.value) }))
              }
              aria-label="Minimum rating"
            />
          </label>

          <label className="field">
            <span>Distance (km): {filters.distanceRadius}</span>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={filters.distanceRadius}
              disabled={coords.latitude == null || coords.longitude == null}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, distanceRadius: Number(event.target.value) }))
              }
              aria-label="Distance radius in kilometers"
            />
          </label>

          <label className="field field--inline">
            <input
              type="checkbox"
              checked={filters.openNow}
              onChange={(event) => setFilters((prev) => ({ ...prev, openNow: event.target.checked }))}
              aria-label="Open now"
            />
            <span>Open now</span>
          </label>
        </div>

        <div className="advancedFiltersRow">
          <div className="filterGroup">
            <div className="filterGroup__label">Price</div>
            <div className="filterGroup__options">
              {PRICE_OPTIONS.map((price) => (
                <label key={price} className="field field--inline">
                  <input
                    type="checkbox"
                    checked={filters.priceRange.includes(price)}
                    onChange={() => toggleArrayFilter("priceRange", price)}
                    aria-label={`Price ${price}`}
                  />
                  <span>{price}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="filterGroup">
            <div className="filterGroup__label">Dietary</div>
            <div className="filterGroup__options">
              {DIETARY_OPTIONS.map((dietary) => (
                <label key={dietary} className="field field--inline">
                  <input
                    type="checkbox"
                    checked={filters.dietarySupport.includes(dietary)}
                    onChange={() => toggleArrayFilter("dietarySupport", dietary)}
                    aria-label={`Dietary ${dietary}`}
                  />
                  <span>{dietary}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {coords.status === "denied" && (
          <p className="placeholderPage__text">
            Location denied. Showing all areas without distance filtering.
          </p>
        )}
      </div>

      <div className="exploreLayout">
        <section className="exploreMapPanel">
          <div className="exploreMapCanvas">
            {restaurantsWithCoords.map((restaurant) => (
              <button
                key={`marker-${restaurant.id}`}
                className={`exploreMarker ${selectedRestaurantId === restaurant.id || hoveredRestaurantId === restaurant.id ? "is-active" : ""}`}
                style={markerPosition(restaurant)}
                onClick={() => focusRestaurantFromMap(restaurant.id)}
                title={restaurant.name}
                type="button"
                aria-label={`Open ${restaurant.name} from map`}
              >
                {restaurant.active_event_count > 0 ? "E" : "•"}
              </button>
            ))}
            {!restaurantsWithCoords.length && (
              <p className="placeholderPage__text">
                No restaurants with location coordinates available for map markers.
              </p>
            )}
          </div>

          {selectedRestaurant && (
            <div className="explorePreviewCard">
              <h3>{selectedRestaurant.name}</h3>
              <p>{selectedRestaurant.cuisine}</p>
              <p>Rating {selectedRestaurant.rating ?? "N/A"}</p>
              {selectedRestaurant.distance_km != null && <p>{selectedRestaurant.distance_km} km away</p>}
              <button
                className="btn btn--gold"
                type="button"
                onClick={() => onOpenRestaurant?.(selectedRestaurant)}
              >
                View Details
              </button>
            </div>
          )}
        </section>

        <section className="exploreListPanel">
          {loading ? (
            <LoadingSkeleton variant="list" count={6} />
          ) : error ? (
            <p className="fieldError">{error}</p>
          ) : restaurants.length === 0 ? (
            <EmptyState
              title="No restaurants found"
              message="Try relaxing your map filters."
            />
          ) : (
            <div className="exploreList" ref={listContainerRef}>
              {restaurants.map((restaurant) => (
                <article
                  key={`list-${restaurant.id}`}
                  className={`restaurantCard exploreListCard ${selectedRestaurantId === restaurant.id || hoveredRestaurantId === restaurant.id ? "is-active" : ""}`}
                  onClick={() => setSelectedRestaurantId(restaurant.id)}
                  onMouseEnter={() => setHoveredRestaurantId(restaurant.id)}
                  onMouseLeave={() => setHoveredRestaurantId(null)}
                  onFocus={() => setHoveredRestaurantId(restaurant.id)}
                  onBlur={() => setHoveredRestaurantId(null)}
                  ref={(element) => { if (element) listItemRefs.current[restaurant.id] = element; }}
                  tabIndex={0}
                >
                  <div className="restaurantCard__body">
                    <div className="restaurantCard__name">{restaurant.name}</div>
                    <div className="restaurantCard__cuisine">{restaurant.cuisine}</div>
                    <div className="restaurantCard__rating">Rating {restaurant.rating ?? "N/A"}</div>
                    {restaurant.distance_km != null && (
                      <div className="discoverFeedCard__meta">{restaurant.distance_km} km away</div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
