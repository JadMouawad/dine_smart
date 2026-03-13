import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { FiSliders } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext.jsx";
import { searchRestaurants } from "../../services/restaurantService";

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

const defaultFilters = {
  minRating: 0,
  distanceRadius: 50,
  priceRange: [],
  dietarySupport: [],
  openNow: false,
  verifiedOnly: false,
  cuisines: [],
};

function parseCoord(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createRestaurantIcon(restaurant, isSelected) {
  const label =
    restaurant.name.length > 16
      ? restaurant.name.slice(0, 16) + "…"
      : restaurant.name;
  return L.divIcon({
    className: "",
    html: `<div class="exploreMarker__pill${isSelected ? " is-selected" : ""}">${label}</div>`,
    iconAnchor: [0, 10],
    popupAnchor: [0, -10],
  });
}

const userLocationIcon = L.divIcon({
  className: "",
  html: '<div class="exploreUserDot"></div>',
  iconAnchor: [10, 10],
});

function MapController({ center }) {
  const map = useMap();
  const prevKey = useRef(null);

  useEffect(() => {
    if (!center) return;
    const key = `${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
    if (prevKey.current === key) return;
    prevKey.current = key;
    map.setView([center.lat, center.lng], Math.max(map.getZoom(), 13), {
      animate: true,
      duration: 0.25,
    });
  }, [center, map]);

  return null;
}

export default function UserExplore({ onOpenRestaurant }) {
  const { user } = useAuth();

  // Two-stage query so typing is instant but search is debounced
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");

  const [filters, setFilters] = useState(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [coords, setCoords] = useState({ latitude: null, longitude: null, status: "idle" });
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);

  const cardRefs = useRef({});

  // Debounce search input → 400 ms
  useEffect(() => {
    const timer = setTimeout(() => setQuery(queryInput), 400);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const profileCoords = useMemo(() => {
    const latitude = parseCoord(user?.latitude);
    const longitude = parseCoord(user?.longitude);
    if (latitude == null || longitude == null) return { latitude: null, longitude: null };
    return { latitude, longitude };
  }, [user?.latitude, user?.longitude]);

  const effectiveCoords = useMemo(() => {
    if (coords.latitude != null && coords.longitude != null) return coords;
    return { latitude: profileCoords.latitude, longitude: profileCoords.longitude, status: coords.status };
  }, [coords, profileCoords.latitude, profileCoords.longitude]);

  // Request browser geolocation once
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
      () => setCoords({ latitude: null, longitude: null, status: "denied" }),
      { timeout: 7000 }
    );
  }, []);

  // Fetch restaurants whenever search params change
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
        setRestaurants(Array.isArray(data) ? data : []);
        setSelectedRestaurantId(null);
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setRestaurants([]);
        setError(fetchError.message || "Failed to load results.");
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
      restaurants.filter(
        (r) => parseCoord(r.latitude) != null && parseCoord(r.longitude) != null
      ),
    [restaurants]
  );

  const selectedRestaurant = useMemo(
    () => restaurants.find((r) => r.id === selectedRestaurantId) || null,
    [restaurants, selectedRestaurantId]
  );

  // Scroll selected card into view in the left panel
  useEffect(() => {
    if (!selectedRestaurantId) return;
    const el = cardRefs.current[selectedRestaurantId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedRestaurantId]);

  const mapCenter = useMemo(() => {
    if (selectedRestaurant) {
      const lat = parseCoord(selectedRestaurant.latitude);
      const lng = parseCoord(selectedRestaurant.longitude);
      if (lat != null && lng != null) return { lat, lng };
    }
    if (effectiveCoords.latitude != null && effectiveCoords.longitude != null)
      return { lat: effectiveCoords.latitude, lng: effectiveCoords.longitude };
    if (restaurantsWithCoords.length > 0)
      return {
        lat: parseCoord(restaurantsWithCoords[0].latitude),
        lng: parseCoord(restaurantsWithCoords[0].longitude),
      };
    return DEFAULT_CENTER;
  }, [selectedRestaurant, effectiveCoords.latitude, effectiveCoords.longitude, restaurantsWithCoords]);

  const activeFilterCount = [
    filters.priceRange.length,
    filters.dietarySupport.length,
    filters.cuisines.length,
    filters.minRating > 0 ? 1 : 0,
    filters.openNow ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const toggleArrayFilter = (key, value) => {
    setFilters((prev) => {
      const current = prev[key] || [];
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const resetFilters = () => setFilters(defaultFilters);

  const handleSelectRestaurant = useCallback((id) => {
    setSelectedRestaurantId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="explorePage">

      {/* ── Top bar: search + Filters button ── */}
      <div className="exploreTopBar">
        <input
          className="searchInput exploreTopBar__search"
          type="text"
          placeholder="Search restaurants or neighborhoods…"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          aria-label="Search restaurants"
        />
        <button
          className={`exploreFiltersBtn${activeFilterCount > 0 ? " has-active" : ""}`}
          type="button"
          onClick={() => setFiltersOpen((p) => !p)}
          aria-expanded={filtersOpen}
        >
          <FiSliders />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="exploreFiltersBtn__badge">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {/* ── Inline filter panel ── */}
      {filtersOpen && (
        <section className="exploreFiltersPanel exploreFiltersPanel--inline">
          <div className="exploreFiltersPanel__top">
            <div />
            <button className="btn btn--ghost" type="button" onClick={resetFilters}>
              Reset
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
                  onClick={() => toggleArrayFilter("cuisines", cuisine)}
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
            <span>Distance: {filters.distanceRadius} km</span>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={filters.distanceRadius}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, distanceRadius: Number(e.target.value) }))
              }
              aria-label="Distance radius"
            />
          </label>
        </section>
      )}

      {/* ── Split body: list (left) + map (right) ── */}
      <div className="exploreBody">

        {/* Left: scrollable restaurant list */}
        <div className="exploreListPanel">
          <p className="exploreListCount">
            {loading
              ? "Searching…"
              : `${restaurants.length} restaurant${restaurants.length !== 1 ? "s" : ""} found`}
          </p>
          {error && <p className="fieldError">{error}</p>}

          <div className="exploreListGrid">
            {restaurants.map((restaurant) => (
              <article
                key={restaurant.id}
                ref={(el) => { cardRefs.current[restaurant.id] = el; }}
                className={`exploreListCard${selectedRestaurantId === restaurant.id ? " is-selected" : ""}`}
                onClick={() => handleSelectRestaurant(restaurant.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleSelectRestaurant(restaurant.id)}
              >
                {/* Cover image */}
                <div className="exploreListCard__img">
                  {(restaurant.coverUrl || restaurant.cover_url) ? (
                    <img
                      src={restaurant.coverUrl || restaurant.cover_url}
                      alt={restaurant.name}
                      onError={(e) => {
                        e.currentTarget.parentElement.classList.add("exploreListCard__img--placeholder");
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="exploreListCard__img--placeholder" />
                  )}
                </div>

                <div className="exploreListCard__name">{restaurant.name}</div>
                <div className="exploreListCard__cuisine">
                  {restaurant.cuisine || "Cuisine not set"}
                </div>
                <div className="exploreListCard__meta">
                  <span>⭐ {restaurant.rating ?? "N/A"}</span>
                  {restaurant.distance_km != null && (
                    <span>{restaurant.distance_km} km</span>
                  )}
                </div>
                <button
                  className="btn btn--gold exploreListCard__viewBtn"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenRestaurant?.(restaurant);
                  }}
                >
                  View
                </button>
              </article>
            ))}
          </div>
        </div>

        {/* Right: map with rounded corners + CartoDB light tiles */}
        <div className="exploreMapWrapper">
          <MapContainer
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={13}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <MapController center={mapCenter} />

            {/* Blue dot for user's current location */}
            {effectiveCoords.latitude != null && effectiveCoords.longitude != null && (
              <Marker
                position={[effectiveCoords.latitude, effectiveCoords.longitude]}
                icon={userLocationIcon}
                zIndexOffset={500}
              />
            )}

            {/* Restaurant name-pill markers */}
            {restaurantsWithCoords.map((restaurant) => {
              const lat = parseCoord(restaurant.latitude);
              const lng = parseCoord(restaurant.longitude);
              if (lat == null || lng == null) return null;
              return (
                <Marker
                  key={`marker-${restaurant.id}`}
                  position={[lat, lng]}
                  icon={createRestaurantIcon(restaurant, restaurant.id === selectedRestaurantId)}
                  eventHandlers={{ click: () => handleSelectRestaurant(restaurant.id) }}
                />
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
