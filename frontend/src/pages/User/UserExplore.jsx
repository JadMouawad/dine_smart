import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { FiSliders } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext.jsx";
import { searchRestaurants } from "../../services/restaurantService";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const DEFAULT_CENTER = { lat: 33.893791, lng: 35.501777 };

import { CUISINES, PRICE_OPTIONS, DIETARY_OPTIONS, RATING_OPTIONS } from "../../constants/filters";


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
  const [gpsDenied, setGpsDenied]     = useState(false);

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

  // GPS — getCurrentPosition for immediate fix, watchPosition for live updates
  useEffect(() => {
    if (!navigator.geolocation) { setGpsDenied(true); return; }

    function applyPos(pos) {
      const lat = Number(pos.coords.latitude.toFixed(6));
      const lng = Number(pos.coords.longitude.toFixed(6));
      setGpsCoords({ lat, lng });
      setGpsDenied(false);
      setViewState((vs) => ({ ...vs, latitude: lat, longitude: lng, zoom: Math.max(vs.zoom, 14) }));
    }

    async function tryIpFallback() {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        if (data.latitude && data.longitude) {
          setGpsCoords({ lat: Number(data.latitude), lng: Number(data.longitude) });
          setViewState((vs) => ({ ...vs, latitude: Number(data.latitude), longitude: Number(data.longitude), zoom: Math.max(vs.zoom, 13) }));
        }
      } catch {
        // IP lookup failed too — stay at default
      }
    }

    function handleErr(err) {
      if (err.code === 1) {
        setGpsDenied(true); // PERMISSION_DENIED — user blocked it
      } else {
        // POSITION_UNAVAILABLE or TIMEOUT (e.g. Mac on hotspot) — try IP fallback
        tryIpFallback();
      }
    }

    // Fast one-shot to show dot immediately (no waiting for watchPosition's first tick)
    navigator.geolocation.getCurrentPosition(applyPos, handleErr, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 0,
    });

    // Then keep updating
    watchIdRef.current = navigator.geolocation.watchPosition(applyPos, handleErr, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 0,
    });

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

  // Memoize marker JSX — only re-renders when restaurants list or selection changes
  const restaurantMarkers = useMemo(() => restaurantsWithCoords.map((restaurant) => {
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
  }), [restaurantsWithCoords, selectedRestaurantId]);

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

      {/* ── GPS denied banner ── */}
      {gpsDenied && (
        <div className="exploreGpsBanner">
          <span>📍 Location blocked.</span>
          <span className="exploreGpsBanner__steps">
            In your browser address bar, click the lock icon → <strong>Site settings</strong> → set <strong>Location</strong> to <em>Allow</em>, then refresh.
          </span>
        </div>
      )}

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

        {/* 📍 Re-center — appears when GPS fix or profile coords available */}
        {(gpsCoords.lat != null || profileCoords != null) && (
          <button
            className="exploreLocateBtn is-granted"
            type="button"
            title="Center map on my location"
            onClick={() => {
              const lat = gpsCoords.lat ?? profileCoords?.lat;
              const lng = gpsCoords.lng ?? profileCoords?.lng;
              setViewState((vs) => ({ ...vs, latitude: lat, longitude: lng, zoom: 15 }));
            }}
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
      <AnimatePresence>
      {filtersOpen && (
        <>
          <motion.div
            className="exploreFilterBackdrop"
            onClick={() => setFiltersOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />

          <motion.div
            className="exploreFilterDropdown"
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >

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

          </motion.div>
        </>
      )}
      </AnimatePresence>

      {/* ── Split body ── */}
      <div className="exploreBody">

        {/* Left: restaurant list */}
        <div className="exploreListPanel">
          <p className="exploreListCount">
            {loading ? "Searching…" : `${restaurants.length} restaurant${restaurants.length !== 1 ? "s" : ""} found`}
          </p>
          {error && <p className="fieldError">{error}</p>}

          <div className="exploreListGrid">
            {restaurants.map((restaurant, i) => (
              <motion.article
                key={restaurant.id}
                ref={(el) => { cardRefs.current[restaurant.id] = el; }}
                className={`exploreListCard${selectedRestaurantId === restaurant.id ? " is-selected" : ""}`}
                onClick={() => handleSelectRestaurant(restaurant.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleSelectRestaurant(restaurant.id)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04, ease: "easeOut" }}
                whileHover={{ scale: 1.02 }}
              >
                {/* Full-bleed background image */}
                <div className="exploreListCard__bg">
                  {(restaurant.coverUrl || restaurant.cover_url) && (
                    <img
                      src={restaurant.coverUrl || restaurant.cover_url}
                      alt={restaurant.name}
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  )}
                </div>

                {/* Gradient overlay + all text */}
                <div className="exploreListCard__overlay">
                  <div className="exploreListCard__top">
                    {restaurant.distance_km != null && (
                      <span className="exploreListCard__dist">{restaurant.distance_km} km</span>
                    )}
                  </div>
                  <div className="exploreListCard__bottom">
                    <div className="exploreListCard__name">{restaurant.name}</div>
                    <div className="exploreListCard__foot">
                      <div className="exploreListCard__tags">
                        <span className="exploreListCard__cuisine">{restaurant.cuisine || "Cuisine not set"}</span>
                        <span className="exploreListCard__rating">⭐ {restaurant.rating ?? "N/A"}</span>
                      </div>
                      <button
                        className="exploreListCard__viewBtn"
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpenRestaurant?.(restaurant); }}
                      >View →</button>
                    </div>
                  </div>
                </div>
              </motion.article>
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

            {/* Blue dot — GPS fix preferred, falls back to profile coords */}
            {(() => {
              const dotLat = gpsCoords.lat ?? profileCoords?.lat ?? null;
              const dotLng = gpsCoords.lng ?? profileCoords?.lng ?? null;
              const isApprox = gpsCoords.lat == null && profileCoords != null;
              if (dotLat == null || dotLng == null) return null;
              return (
                <Marker longitude={dotLng} latitude={dotLat} anchor="center">
                  <div className={`exploreUserDot${isApprox ? " exploreUserDot--approx" : ""}`} />
                </Marker>
              );
            })()}

            {/* Restaurant name-pill markers (memoized) */}
            {restaurantMarkers}
          </Map>
        </div>

      </div>
    </div>
  );
}
