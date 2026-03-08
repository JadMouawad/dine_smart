import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useAuth } from "../../auth/AuthContext.jsx";
import { searchRestaurants } from "../../services/restaurantService";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";

const DEFAULT_CENTER = { lat: 33.893791, lng: 35.501777 };
const CUISINES = [
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
const PRICE_OPTIONS = ["$", "$$", "$$$", "$$$$"];
const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Halal", "GF"];
const RATING_OPTIONS = [
  { value: 0, label: "Any" },
  { value: 3.5, label: "3.5+" },
  { value: 4, label: "4.0+" },
  { value: 4.5, label: "4.5+" },
];

const mapMarkerIcon = new L.Icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const defaultFilters = {
  minRating: 0,
  distanceRadius: 10,
  priceRange: [],
  dietarySupport: [],
  openNow: false,
  verifiedOnly: true,
  cuisines: [],
};

function parseCoord(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function MapRecenter({ center }) {
  const map = useMap();

  useEffect(() => {
    if (!center) return;
    map.flyTo([center.lat, center.lng], Math.max(map.getZoom(), 12), {
      animate: true,
      duration: 0.55,
    });
  }, [center, map]);

  return null;
}

export default function UserExplore({ onOpenRestaurant }) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [coords, setCoords] = useState({ latitude: null, longitude: null, status: "idle" });
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const listItemRefs = useRef({});

  const profileCoords = useMemo(() => {
    const latitude = parseCoord(user?.latitude);
    const longitude = parseCoord(user?.longitude);
    if (latitude == null || longitude == null) {
      return { latitude: null, longitude: null };
    }
    return { latitude, longitude };
  }, [user?.latitude, user?.longitude]);

  const effectiveCoords = useMemo(() => {
    if (coords.latitude != null && coords.longitude != null) return coords;
    return {
      latitude: profileCoords.latitude,
      longitude: profileCoords.longitude,
      status: coords.status,
    };
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

    searchRestaurants(query, filters.cuisines, {
      ...filters,
      latitude: effectiveCoords.latitude,
      longitude: effectiveCoords.longitude,
      distanceRadius: filters.distanceRadius,
      onlyLebanon: true,
    })
      .then((data) => {
        if (cancelled) return;
        const nextRestaurants = Array.isArray(data) ? data : [];
        setRestaurants(nextRestaurants);
        setSelectedRestaurantId((prevSelected) => {
          if (!nextRestaurants.length) return null;
          const stillExists = nextRestaurants.some((restaurant) => restaurant.id === prevSelected);
          return stillExists ? prevSelected : nextRestaurants[0].id;
        });
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setRestaurants([]);
        setError(fetchError.message || "Failed to load map results.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, filters, effectiveCoords.latitude, effectiveCoords.longitude]);

  const restaurantsWithCoords = useMemo(
    () =>
      restaurants.filter((restaurant) => parseCoord(restaurant.latitude) != null && parseCoord(restaurant.longitude) != null),
    [restaurants]
  );

  const restaurantsWithoutCoords = useMemo(
    () => restaurants.filter((restaurant) => parseCoord(restaurant.latitude) == null || parseCoord(restaurant.longitude) == null),
    [restaurants]
  );

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) || null,
    [restaurants, selectedRestaurantId]
  );

  const mapCenter = useMemo(() => {
    if (selectedRestaurant) {
      const lat = parseCoord(selectedRestaurant.latitude);
      const lng = parseCoord(selectedRestaurant.longitude);
      if (lat != null && lng != null) return { lat, lng };
    }

    if (effectiveCoords.latitude != null && effectiveCoords.longitude != null) {
      return { lat: effectiveCoords.latitude, lng: effectiveCoords.longitude };
    }

    if (restaurantsWithCoords.length > 0) {
      return {
        lat: parseCoord(restaurantsWithCoords[0].latitude),
        lng: parseCoord(restaurantsWithCoords[0].longitude),
      };
    }

    return DEFAULT_CENTER;
  }, [selectedRestaurant, effectiveCoords.latitude, effectiveCoords.longitude, restaurantsWithCoords]);

  const toggleArrayFilter = (key, value) => {
    setFilters((prev) => {
      const current = prev[key] || [];
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const toggleCuisine = (value) => toggleArrayFilter("cuisines", value);

  const focusFromList = (restaurantId) => {
    setSelectedRestaurantId(restaurantId);
    const target = listItemRefs.current[restaurantId];
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const resetFilters = () => setFilters(defaultFilters);

  return (
    <div className="userSearchPage">
      <h1 className="userSearchPage__title">Explore Map</h1>

      <section className="exploreFiltersPanel">
        <div className="exploreFiltersPanel__top">
          <input
            className="searchInput"
            type="text"
            placeholder="Search restaurants or neighborhoods"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search restaurants on map"
          />
          <button className="btn btn--ghost" type="button" onClick={resetFilters}>
            Reset Filters
          </button>
        </div>

        <div className="exploreFilterGroup">
          <div className="exploreFilterGroup__label">Category</div>
          <div className="exploreChipRow">
            {CUISINES.map((cuisine) => (
              <button
                key={cuisine}
                type="button"
                className={`quickFilterBtn ${filters.cuisines.includes(cuisine) ? "is-active" : ""}`}
                onClick={() => toggleCuisine(cuisine)}
                aria-pressed={filters.cuisines.includes(cuisine)}
              >
                {cuisine}
              </button>
            ))}
          </div>
        </div>

        <div className="exploreFilterGroup">
          <div className="exploreFilterGroup__label">Price</div>
          <div className="exploreChipRow">
            {PRICE_OPTIONS.map((price) => (
              <button
                key={price}
                type="button"
                className={`quickFilterBtn ${filters.priceRange.includes(price) ? "is-active" : ""}`}
                onClick={() => toggleArrayFilter("priceRange", price)}
                aria-pressed={filters.priceRange.includes(price)}
              >
                {price}
              </button>
            ))}
          </div>
        </div>

        <div className="exploreFilterGroup">
          <div className="exploreFilterGroup__label">Dietary</div>
          <div className="exploreChipRow">
            {DIETARY_OPTIONS.map((dietary) => (
              <button
                key={dietary}
                type="button"
                className={`quickFilterBtn ${filters.dietarySupport.includes(dietary) ? "is-active" : ""}`}
                onClick={() => toggleArrayFilter("dietarySupport", dietary)}
                aria-pressed={filters.dietarySupport.includes(dietary)}
              >
                {dietary}
              </button>
            ))}
          </div>
        </div>

        <div className="exploreFilterGroup">
          <div className="exploreFilterGroup__label">Rating</div>
          <div className="exploreChipRow">
            {RATING_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                className={`quickFilterBtn ${Number(filters.minRating) === option.value ? "is-active" : ""}`}
                onClick={() => setFilters((prev) => ({ ...prev, minRating: option.value }))}
                aria-pressed={Number(filters.minRating) === option.value}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              className={`quickFilterBtn ${filters.openNow ? "is-active" : ""}`}
              onClick={() => setFilters((prev) => ({ ...prev, openNow: !prev.openNow }))}
              aria-pressed={filters.openNow}
            >
              Open Now
            </button>
          </div>
        </div>

        <label className="field">
          <span>Distance radius: {filters.distanceRadius} km</span>
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={filters.distanceRadius}
            onChange={(event) => setFilters((prev) => ({ ...prev, distanceRadius: Number(event.target.value) }))}
            aria-label="Distance radius"
          />
        </label>

        {(coords.status === "denied" || coords.status === "unsupported")
          && (effectiveCoords.latitude == null || effectiveCoords.longitude == null) && (
          <p className="placeholderPage__text">
            Location unavailable. Map results are still visible, but distance filtering may be less accurate.
          </p>
        )}
      </section>

      <div className="exploreLayout">
        <section className="exploreMapPanel">
          <div className="exploreMapCanvas">
            <MapContainer
              center={[mapCenter.lat, mapCenter.lng]}
              zoom={13}
              scrollWheelZoom
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapRecenter center={mapCenter} />

              {restaurantsWithCoords.map((restaurant) => {
                const lat = parseCoord(restaurant.latitude);
                const lng = parseCoord(restaurant.longitude);
                if (lat == null || lng == null) return null;

                return (
                  <Marker
                    key={`marker-${restaurant.id}`}
                    position={[lat, lng]}
                    icon={mapMarkerIcon}
                    eventHandlers={{ click: () => setSelectedRestaurantId(restaurant.id) }}
                  >
                    <Popup>
                      <div className="explorePopup">
                        <strong>{restaurant.name}</strong>
                        <div>{restaurant.cuisine || "Cuisine not set"}</div>
                        <div>Rating {restaurant.rating ?? "N/A"}</div>
                        <button
                          className="btn btn--gold"
                          type="button"
                          onClick={() => onOpenRestaurant?.(restaurant)}
                        >
                          View Details
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {!!restaurantsWithoutCoords.length && (
            <div className="exploreMapLegend">
              {restaurantsWithoutCoords.length} restaurants are missing coordinates and only appear in the list.
            </div>
          )}

          {selectedRestaurant && (
            <div className="explorePreviewCard">
              <h3>{selectedRestaurant.name}</h3>
              <p>{selectedRestaurant.cuisine || "Cuisine not set"}</p>
              <p>Rating {selectedRestaurant.rating ?? "N/A"}</p>
              <p>{selectedRestaurant.distance_km != null ? `${selectedRestaurant.distance_km} km away` : "Distance unavailable"}</p>
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
              actionLabel="Reset Filters"
              onAction={resetFilters}
            />
          ) : (
            <div className="exploreList">
              {restaurants.map((restaurant) => (
                <article
                  key={`list-${restaurant.id}`}
                  className={`restaurantCard exploreListCard ${selectedRestaurantId === restaurant.id ? "is-active" : ""}`}
                  onClick={() => focusFromList(restaurant.id)}
                  ref={(element) => {
                    if (element) listItemRefs.current[restaurant.id] = element;
                  }}
                  tabIndex={0}
                >
                  <div className="restaurantCard__body">
                    <div className="restaurantCard__name">{restaurant.name}</div>
                    <div className="restaurantCard__cuisine">{restaurant.cuisine || "Cuisine not set"}</div>
                    <div className="restaurantCard__rating">Rating {restaurant.rating ?? "N/A"}</div>
                    <div className="discoverFeedCard__meta">
                      {restaurant.distance_km != null
                        ? `${restaurant.distance_km} km away`
                        : (restaurant.address || "Location unavailable")}
                    </div>
                    <button
                      className="btn btn--gold"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenRestaurant?.(restaurant);
                      }}
                    >
                      View Details
                    </button>
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
