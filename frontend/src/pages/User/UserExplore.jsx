import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { FiSliders } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext.jsx";
import { searchRestaurants } from "../../services/restaurantService";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const DEFAULT_CENTER = { lat: 33.893791, lng: 35.501777 };

const CUISINES = [
  "American","Middle Eastern","French","Mexican","Chinese",
  "Japanese","Italian","Indian","International",
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
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

export default function UserExplore({ onOpenRestaurant }) {
  const { user } = useAuth();

  const [queryInput, setQueryInput]   = useState("");
  const [query, setQuery]             = useState("");
  const [filters, setFilters]         = useState(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [gpsCoords, setGpsCoords]     = useState({ lat: null, lng: null });

  const cardRefs  = useRef({});
  const watchIdRef = useRef(null);

  const profileCoords = useMemo(() => {
    const lat = parseCoord(user?.latitude);
    const lng = parseCoord(user?.longitude);
    if (!lat || !lng) return null;
    return { lat, lng };
  }, [user?.latitude, user?.longitude]);

  const mapCenter = useMemo(() => {
    if (gpsCoords.lat != null && gpsCoords.lng != null) return gpsCoords;
    if (profileCoords) return profileCoords;
    return { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng };
  }, [gpsCoords, profileCoords]);

  const [viewState, setViewState] = useState({
    longitude: profileCoords?.lng || DEFAULT_CENTER.lng,
    latitude:  profileCoords?.lat || DEFAULT_CENTER.lat,
    zoom: 13,
  });

  // Silent background GPS — retries automatically, works on non-GPS devices
  useEffect(() => {
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setGpsCoords({ lat, lng });
        setViewState((vs) => ({ ...vs, latitude: lat, longitude: lng, zoom: Math.max(vs.zoom, 14) }));
      },
      () => { /* silently ignore — map stays at profile/default */ },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
    );
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput), 400);
    return () => clearTimeout(t);
  }, [queryInput]);

  // Fetch restaurants
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    searchRestaurants(query, filters.cuisines, {
      ...filters,
      latitude:       mapCenter.lat,
      longitude:      mapCenter.lng,
      distanceRadius: filters.distanceRadius,
      onlyLebanon:    true,
    })
      .then((data) => { if (!cancelled) { setRestaurants(Array.isArray(data) ? data : []); setSelectedRestaurantId(null); } })
      .catch((err)  => { if (!cancelled) { setRestaurants([]); setError(err.message || "Failed to load results."); } })
      .finally(()   => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, filters, mapCenter.lat, mapCenter.lng]);

  const restaurantsWithCoords = useMemo(
    () => restaurants.filter((r) => parseCoord(r.latitude) != null && parseCoord(r.longitude) != null),
    [restaurants]
  );

  useEffect(() => {
    if (!selectedRestaurantId) return;
    cardRefs.current[selectedRestaurantId]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedRestaurantId]);

  const activeFilterCount = [
    filters.priceRange.length,
    filters.dietarySupport.length,
    filters.cuisines.length,
    filters.minRating > 0 ? 1 : 0,
    filters.openNow ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const toggleArrayFilter = (key, value) =>
    setFilters((prev) => {
      const arr  = prev[key] || [];
      const next = arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
      return { ...prev, [key]: next };
    });

  const resetFilters = () => setFilters(defaultFilters);

  const handleSelectRestaurant = useCallback((id) => {
    setSelectedRestaurantId((prev) => (prev === id ? null : id));
    const r = restaurants.find((x) => x.id === id);
    if (r) {
      const lat = parseCoord(r.latitude);
      const lng = parseCoord(r.longitude);
      if (lat != null && lng != null)
        setViewState((vs) => ({ ...vs, longitude: lng, latitude: lat, zoom: Math.max(vs.zoom, 15) }));
    }
  }, [restaurants]);

  const sliderPct = ((filters.distanceRadius - 1) / 49 * 100).toFixed(1);

  return (
    <div className="explorePage">

      {/* ── Top bar ── */}
      <div className="exploreTopBar">
        <input
          className="searchInput exploreTopBar__search"
          type="text"
          placeholder="Search restaurants or neighborhoods…"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          aria-label="Search restaurants"
        />

        {/* 📍 Re-center — appears only when GPS has a fix */}
        {gpsCoords.lat != null && (
          <button
            className="exploreLocateBtn is-granted"
            type="button"
            title="Center map on my location"
            onClick={() => setViewState((vs) => ({ ...vs, latitude: gpsCoords.lat, longitude: gpsCoords.lng, zoom: 15 }))}
          >📍</button>
        )}

        {/* Filters toggle */}
        <button
          className={`exploreFiltersBtn${activeFilterCount > 0 ? " has-active" : ""}`}
          type="button"
          onClick={() => setFiltersOpen((p) => !p)}
          aria-expanded={filtersOpen}
        >
          <FiSliders />
          <span>Filters</span>
          {activeFilterCount > 0 && <span className="exploreFiltersBtn__badge">{activeFilterCount}</span>}
        </button>
      </div>

      {/* ── Floating filter dropdown (fixed — escapes overflow:hidden) ── */}
      {filtersOpen && (
        <>
          <div className="exploreFilterBackdrop" onClick={() => setFiltersOpen(false)} />

          <div className="exploreFilterDropdown">

            {/* Header */}
            <div className="exploreFilterDropdown__head">
              <span className="exploreFilterDropdown__title">
                Filters
                {activeFilterCount > 0 && <em>{activeFilterCount} active</em>}
              </span>
              <button className="exploreFilterDropdown__reset" type="button" onClick={resetFilters}>
                Reset all
              </button>
            </div>

            {/* Cuisine */}
            <div className="exploreFilterSection">
              <p className="exploreFilterSection__label">Cuisine</p>
              <div className="exploreFilterChips">
                {CUISINES.map((c) => (
                  <button key={c} type="button"
                    className={`filterChip${filters.cuisines.includes(c) ? " filterChip--on" : ""}`}
                    onClick={() => toggleArrayFilter("cuisines", c)}
                  >{c}</button>
                ))}
              </div>
            </div>

            <div className="exploreFilterDivider" />

            {/* Price + Dietary side by side */}
            <div className="exploreFilterRow2">
              <div className="exploreFilterSection">
                <p className="exploreFilterSection__label">Price</p>
                <div className="exploreFilterChips">
                  {PRICE_OPTIONS.map((p) => (
                    <button key={p} type="button"
                      className={`filterChip${filters.priceRange.includes(p) ? " filterChip--on" : ""}`}
                      onClick={() => toggleArrayFilter("priceRange", p)}
                    >{p}</button>
                  ))}
                </div>
              </div>
              <div className="exploreFilterSection">
                <p className="exploreFilterSection__label">Dietary</p>
                <div className="exploreFilterChips">
                  {DIETARY_OPTIONS.map((d) => (
                    <button key={d} type="button"
                      className={`filterChip${filters.dietarySupport.includes(d) ? " filterChip--on" : ""}`}
                      onClick={() => toggleArrayFilter("dietarySupport", d)}
                    >{d}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="exploreFilterDivider" />

            {/* Rating + Open Now */}
            <div className="exploreFilterSection">
              <div className="exploreFilterSection__labelRow">
                <p className="exploreFilterSection__label">Min Rating</p>
                <button
                  type="button"
                  className={`filterChip filterChip--openNow${filters.openNow ? " filterChip--on" : ""}`}
                  onClick={() => setFilters((prev) => ({ ...prev, openNow: !prev.openNow }))}
                >
                  <span className="filterChip__dot" />
                  Open Now
                </button>
              </div>
              <div className="exploreFilterChips">
                {RATING_OPTIONS.map((opt) => (
                  <button key={opt.label} type="button"
                    className={`filterChip${Number(filters.minRating) === opt.value ? " filterChip--on" : ""}`}
                    onClick={() => setFilters((prev) => ({ ...prev, minRating: opt.value }))}
                  >{opt.label}</button>
                ))}
              </div>
            </div>

            <div className="exploreFilterDivider" />

            {/* Distance */}
            <div className="exploreFilterSection">
              <div className="exploreFilterSection__labelRow">
                <p className="exploreFilterSection__label">Distance</p>
                <span className="exploreFilterSection__value">{filters.distanceRadius} km</span>
              </div>
              <input
                className="exploreFilterRange"
                type="range" min="1" max="50" step="1"
                value={filters.distanceRadius}
                style={{ "--pct": sliderPct }}
                onChange={(e) => setFilters((prev) => ({ ...prev, distanceRadius: Number(e.target.value) }))}
                aria-label="Distance radius"
              />
              <div className="exploreFilterRange__ticks">
                <span>1 km</span><span>25 km</span><span>50 km</span>
              </div>
            </div>

          </div>
        </>
      )}

      {/* ── Split body ── */}
      <div className="exploreBody">

        {/* Left: restaurant list */}
        <div className="exploreListPanel">
          <p className="exploreListCount">
            {loading ? "Searching…" : `${restaurants.length} restaurant${restaurants.length !== 1 ? "s" : ""} found`}
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
                <div className="exploreListCard__cuisine">{restaurant.cuisine || "Cuisine not set"}</div>
                <div className="exploreListCard__meta">
                  <span>⭐ {restaurant.rating ?? "N/A"}</span>
                  {restaurant.distance_km != null && <span>{restaurant.distance_km} km</span>}
                </div>
                <button
                  className="btn btn--gold exploreListCard__viewBtn"
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenRestaurant?.(restaurant); }}
                >View</button>
              </article>
            ))}
          </div>
        </div>

        {/* Right: map */}
        <div className="exploreMapWrapper">
          <Map
            {...viewState}
            onMove={(evt) => setViewState(evt.viewState)}
            mapboxAccessToken={MAPBOX_TOKEN}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
          >
            <NavigationControl position="top-right" />

            {/* Blue dot — only when GPS has a fix */}
            {gpsCoords.lat != null && gpsCoords.lng != null && (
              <Marker longitude={gpsCoords.lng} latitude={gpsCoords.lat} anchor="center">
                <div className="exploreUserDot" />
              </Marker>
            )}

            {/* Restaurant name-pill markers */}
            {restaurantsWithCoords.map((restaurant) => {
              const lat = parseCoord(restaurant.latitude);
              const lng = parseCoord(restaurant.longitude);
              if (lat == null || lng == null) return null;
              const label = restaurant.name.length > 16 ? restaurant.name.slice(0, 16) + "…" : restaurant.name;
              return (
                <Marker key={`marker-${restaurant.id}`} longitude={lng} latitude={lat} anchor="bottom">
                  <div
                    className={`exploreMarker__pill${selectedRestaurantId === restaurant.id ? " is-selected" : ""}`}
                    onClick={() => handleSelectRestaurant(restaurant.id)}
                  >{label}</div>
                </Marker>
              );
            })}
          </Map>
        </div>

      </div>
    </div>
  );
}
