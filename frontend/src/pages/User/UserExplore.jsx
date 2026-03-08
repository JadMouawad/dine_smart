import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { searchRestaurants } from "../../services/restaurantService";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";

const LEBANON_BOUNDS = {
  minLat: 33.0,
  maxLat: 34.75,
  minLng: 35.05,
  maxLng: 36.7,
};
const LEBANON_CENTER = {
  lat: 33.893791,
  lng: 35.501777,
};

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

const DIETARY_OPTIONS = [
  { value: "Vegetarian", label: "Vegetarian" },
  { value: "Vegan", label: "Vegan" },
  { value: "Halal", label: "Halal" },
  { value: "GF", label: "Gluten-Free" },
];
const PRICE_OPTIONS = [
  { value: "$", label: "Budget" },
  { value: "$$", label: "Moderate" },
  { value: "$$$", label: "Premium" },
  { value: "$$$$", label: "Luxury" },
];

function isWithinLebanon(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return false;
  return latNum >= LEBANON_BOUNDS.minLat
    && latNum <= LEBANON_BOUNDS.maxLat
    && lngNum >= LEBANON_BOUNDS.minLng
    && lngNum <= LEBANON_BOUNDS.maxLng;
}

const defaultFilters = {
  minRating: 1,
  distanceRadius: 10,
  priceRange: [],
  dietarySupport: [],
  openNow: false,
  verifiedOnly: true,
};

function buildFallbackMarkerPositions(count) {
  const positions = [];
  if (count <= 0) return positions;
  const columns = Math.max(2, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / columns);

  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const left = 8 + (col * (84 / Math.max(columns - 1, 1)));
    const top = 12 + (row * (76 / Math.max(rows - 1, 1)));
    positions.push({
      left: `${Math.min(95, Math.max(5, left))}%`,
      top: `${Math.min(95, Math.max(5, top))}%`,
    });
  }

  return positions;
}

export default function UserExplore({ onOpenRestaurant }) {
  const { user } = useAuth();
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
  const profileCoords = useMemo(() => {
    const latitude = Number(user?.latitude);
    const longitude = Number(user?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { latitude: null, longitude: null };
    }
    return { latitude, longitude };
  }, [user?.latitude, user?.longitude]);
  const effectiveCoords = useMemo(() => {
    if (coords.latitude != null && coords.longitude != null) return coords;
    return { latitude: profileCoords.latitude, longitude: profileCoords.longitude, status: coords.status };
  }, [coords, profileCoords.latitude, profileCoords.longitude]);

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
      latitude: effectiveCoords.latitude,
      longitude: effectiveCoords.longitude,
      // Keep slider interactive even if geolocation is unavailable.
      // Backend will ignore distance filter when coordinates are null.
      distanceRadius: filters.distanceRadius,
      onlyLebanon: true,
    })
      .then((data) => {
        if (cancelled) return;
        const nextRestaurantsRaw = Array.isArray(data) ? data : [];
        const nextRestaurants = nextRestaurantsRaw.filter((restaurant) => {
          if (restaurant.latitude == null || restaurant.longitude == null) return true;
          return isWithinLebanon(restaurant.latitude, restaurant.longitude);
        });
        setRestaurants(nextRestaurants);

        setSelectedRestaurantId((prevSelected) => {
          if (!nextRestaurants.length) return null;
          const stillExists = nextRestaurants.some((restaurant) => restaurant.id === prevSelected);
          return stillExists ? prevSelected : nextRestaurants[0].id;
        });
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
  }, [query, cuisine, filters, effectiveCoords.latitude, effectiveCoords.longitude]);

  const distanceFilteringActive = useMemo(
    () =>
      effectiveCoords.latitude != null
      && effectiveCoords.longitude != null
      && Number(filters.distanceRadius) > 0,
    [effectiveCoords.latitude, effectiveCoords.longitude, filters.distanceRadius]
  );

  const displayedRestaurants = useMemo(
    () =>
      restaurants.filter((restaurant) => {
        if (!distanceFilteringActive) return true;
        return restaurant.distance_km != null;
      }),
    [restaurants, distanceFilteringActive]
  );

  const restaurantsWithCoords = useMemo(
    () =>
      displayedRestaurants.filter(
        (restaurant) => {
          if (restaurant.latitude == null || restaurant.longitude == null) return false;
          if (!isWithinLebanon(restaurant.latitude, restaurant.longitude)) return false;
          return true;
        }
      ),
    [displayedRestaurants]
  );

  const restaurantsWithoutCoords = useMemo(
    () =>
      displayedRestaurants.filter(
        (restaurant) => restaurant.latitude == null || restaurant.longitude == null
      ),
    [displayedRestaurants]
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

  const fallbackMarkerPositions = useMemo(
    () => buildFallbackMarkerPositions(restaurantsWithoutCoords.length),
    [restaurantsWithoutCoords.length]
  );

  const selectedRestaurant = useMemo(
    () => displayedRestaurants.find((restaurant) => restaurant.id === selectedRestaurantId) || null,
    [displayedRestaurants, selectedRestaurantId]
  );

  useEffect(() => {
    setSelectedRestaurantId((previousSelected) => {
      if (!displayedRestaurants.length) return null;
      const stillExists = displayedRestaurants.some((restaurant) => restaurant.id === previousSelected);
      return stillExists ? previousSelected : displayedRestaurants[0].id;
    });
  }, [displayedRestaurants]);

  const mapCenter = useMemo(() => {
    if (selectedRestaurant?.latitude != null && selectedRestaurant?.longitude != null) {
      const selectedLat = Number(selectedRestaurant.latitude);
      const selectedLng = Number(selectedRestaurant.longitude);
      if (isWithinLebanon(selectedLat, selectedLng)) {
        return {
          lat: selectedLat,
          lng: selectedLng,
          label: selectedRestaurant.name || "Selected restaurant",
        };
      }
    }

    if (
      effectiveCoords.latitude != null
      && effectiveCoords.longitude != null
      && isWithinLebanon(effectiveCoords.latitude, effectiveCoords.longitude)
    ) {
      return {
        lat: Number(effectiveCoords.latitude),
        lng: Number(effectiveCoords.longitude),
        label: "Your location",
      };
    }

    if (restaurantsWithCoords.length) {
      return {
        lat: Number(restaurantsWithCoords[0].latitude),
        lng: Number(restaurantsWithCoords[0].longitude),
        label: restaurantsWithCoords[0].name || "Restaurant",
      };
    }

    return {
      lat: LEBANON_CENTER.lat,
      lng: LEBANON_CENTER.lng,
      label: "Beirut",
    };
  }, [selectedRestaurant, effectiveCoords.latitude, effectiveCoords.longitude, restaurantsWithCoords]);

  const googleMapEmbedUrl = useMemo(() => {
    const zoom = mapCenter?.label === "Lebanon" ? 8 : 13;
    return `https://maps.google.com/maps?ll=${encodeURIComponent(`${mapCenter.lat},${mapCenter.lng}`)}&z=${zoom}&t=m&output=embed`;
  }, [mapCenter]);

  const selectedRestaurantMapsUrl = useMemo(() => {
    if (!selectedRestaurant) return "";
    const query = selectedRestaurant.latitude != null && selectedRestaurant.longitude != null
      ? `${selectedRestaurant.latitude},${selectedRestaurant.longitude},Lebanon`
      : `${selectedRestaurant.name || ""} ${selectedRestaurant.address || ""}`.trim();
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
  }, [selectedRestaurant]);

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
                <label key={price.value} className="field field--inline">
                  <input
                    type="checkbox"
                    checked={filters.priceRange.includes(price.value)}
                    onChange={() => toggleArrayFilter("priceRange", price.value)}
                    aria-label={`Price ${price.label}`}
                  />
                  <span>{price.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="filterGroup">
            <div className="filterGroup__label">Dietary</div>
            <div className="filterGroup__options">
              {DIETARY_OPTIONS.map((dietary) => (
                <label key={dietary.value} className="field field--inline">
                  <input
                    type="checkbox"
                    checked={filters.dietarySupport.includes(dietary.value)}
                    onChange={() => toggleArrayFilter("dietarySupport", dietary.value)}
                    aria-label={`Dietary ${dietary.label}`}
                  />
                  <span>{dietary.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {(coords.status === "denied" || coords.status === "unsupported")
          && (effectiveCoords.latitude == null || effectiveCoords.longitude == null) && (
          <p className="placeholderPage__text">
            Location unavailable. Distance slider is still editable, and map markers are shown in approximate layout when coordinates are missing.
          </p>
        )}
      </div>

      <div className="exploreLayout">
        <section className="exploreMapPanel">
          <div className="exploreMapCanvas">
            <iframe
              className="exploreMapEmbed"
              src={googleMapEmbedUrl}
              title="Google map"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />

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
                {restaurant.active_event_count > 0 ? "E" : "o"}
              </button>
            ))}

            {restaurantsWithoutCoords.map((restaurant, index) => (
              <button
                key={`fallback-marker-${restaurant.id}`}
                className={`exploreMarker ${selectedRestaurantId === restaurant.id || hoveredRestaurantId === restaurant.id ? "is-active" : ""}`}
                style={fallbackMarkerPositions[index] || { left: "50%", top: "50%" }}
                onClick={() => focusRestaurantFromMap(restaurant.id)}
                title={`${restaurant.name} (approximate)`}
                type="button"
                aria-label={`Open ${restaurant.name} from map`}
              >
                o
              </button>
            ))}

            {!displayedRestaurants.length && (
              <p className="placeholderPage__text">
                No restaurants available to display on the map.
              </p>
            )}

            {!!displayedRestaurants.length && !restaurantsWithCoords.length && (
              <p className="placeholderPage__text">
                Showing approximate markers because restaurant coordinates are currently missing.
              </p>
            )}
          </div>

          <div className="exploreMapLegend">
            <strong>Map center:</strong> {mapCenter ? mapCenter.label : "General view"}
          </div>

          {selectedRestaurant && (
            <div className="explorePreviewCard">
              <h3>{selectedRestaurant.name}</h3>
              <p>{selectedRestaurant.cuisine}</p>
              <p>Rating {selectedRestaurant.rating ?? "N/A"}</p>
              <p>{selectedRestaurant.distance_km != null ? `${selectedRestaurant.distance_km} km away` : "Distance unavailable"}</p>
              <button
                className="btn btn--gold"
                type="button"
                onClick={() => onOpenRestaurant?.(selectedRestaurant)}
              >
                View Details
              </button>
              {selectedRestaurantMapsUrl && (
                <a
                  className="btn btn--ghost"
                  href={selectedRestaurantMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Google Maps
                </a>
              )}
            </div>
          )}
        </section>

        <section className="exploreListPanel">
          {loading ? (
            <LoadingSkeleton variant="list" count={6} />
          ) : error ? (
            <p className="fieldError">{error}</p>
          ) : displayedRestaurants.length === 0 ? (
            <EmptyState
              title="No restaurants found"
              message="Try relaxing your map filters."
            />
          ) : (
            <div className="exploreList" ref={listContainerRef}>
              {displayedRestaurants.map((restaurant) => (
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
                    <div className="discoverFeedCard__meta">
                      {restaurant.distance_km != null ? `${restaurant.distance_km} km away` : "Distance unavailable"}
                    </div>
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
