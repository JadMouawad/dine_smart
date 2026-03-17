import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { FiSliders } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext.jsx";
import { searchRestaurants } from "../../services/restaurantService";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const DEFAULT_CENTER = { lat: 33.893791, lng: 35.501777 }; // Beirut fallback

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
  // 0 means "not set" (null island) — treat as invalid
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

export default function UserExplore({ onOpenRestaurant }) {
  const { user } = useAuth();

  // Two-stage query so typing is instant but search is debounced
  const [queryInput, setQueryInput]   = useState("");
  const [query, setQuery]             = useState("");
  const [filters, setFilters]         = useState(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);

  // GPS coords from browser (null until granted)
  const [gpsCoords, setGpsCoords] = useState({ lat: null, lng: null });

  const cardRefs = useRef({});
  const watchIdRef = useRef(null);

  // ── Profile-stored coordinates (from signup address picker) ────────────────
  const profileCoords = useMemo(() => {
    const lat = parseCoord(user?.latitude);
    const lng = parseCoord(user?.longitude);
    if (!lat || !lng) return null;
    return { lat, lng };
  }, [user?.latitude, user?.longitude]);

  // ── Best available center: GPS > profile > Beirut default ──────────────────
  const mapCenter = useMemo(() => {
    if (gpsCoords.lat != null && gpsCoords.lng != null) return gpsCoords;
    if (profileCoords) return profileCoords;
    return { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng };
  }, [gpsCoords, profileCoords]);

  // ── Mapbox view state — starts at best known center ────────────────────────
  const [viewState, setViewState] = useState({
    longitude: (profileCoords?.lng) || DEFAULT_CENTER.lng,
    latitude:  (profileCoords?.lat) || DEFAULT_CENTER.lat,
    zoom: 13,
  });

  // ── Silent background GPS via watchPosition ────────────────────────────────
  // watchPosition retries automatically; enableHighAccuracy:false works on
  // non-GPS devices (Mac/PC) using WiFi/network location — much more reliable.
  useEffect(() => {
    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setGpsCoords({ lat, lng });
        // Center map on real location when first GPS fix arrives
        setViewState((vs) => ({ ...vs, latitude: lat, longitude: lng, zoom: Math.max(vs.zoom, 14) }));
      },
      (_err) => {
        // Silently ignore — map stays at profile coords or Beirut default
        // No error shown to user; the app still works without location
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search input → 400 ms
  useEffect(() => {
    const timer = setTimeout(() => setQuery(queryInput), 400);
    return () => clearTimeout(timer);
  }, [queryInput]);

  // Fetch restaurants whenever search params change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    // Use best available location for distance-based search
    const searchLat = mapCenter.lat;
    const searchLng = mapCenter.lng;

    searchRestaurants(query, filters.cuisines, {
      ...filters,
      latitude:       searchLat,
      longitude:      searchLng,
      distanceRadius: filters.distanceRadius,
      onlyLebanon:    true,
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
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [query, filters, mapCenter.lat, mapCenter.lng]);

  const restaurantsWithCoords = useMemo(
    () => restaurants.filter((r) => parseCoord(r.latitude) != null && parseCoord(r.longitude) != null),
    [restaurants]
  );

  // Scroll selected card into view in the left panel
  useEffect(() => {
    if (!selectedRestaurantId) return;
    const el = cardRefs.current[selectedRestaurantId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedRestaurantId]);

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
    setSelectedRestaurantId((prev) => {
      if (prev === id) return null;
      return id;
    });
    const r = restaurants.find((x) => x.id === id);
    if (r) {
      const lat = parseCoord(r.latitude);
      const lng = parseCoord(r.longitude);
      if (lat != null && lng != null) {
        setViewState((vs) => ({ ...vs, longitude: lng, latitude: lat, zoom: Math.max(vs.zoom, 15) }));
      }
    }
  }, [restaurants]);

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
                <button key={cuisine} type="button"
                  className={`quickFilterBtn ${filters.cuisines.includes(cuisine) ? "is-active" : ""}`}
                  onClick={() => toggleArrayFilter("cuisines", cuisine)}
                  aria-pressed={filters.cuisines.includes(cuisine)}
                >{cuisine}</button>
              ))}
            </div>
          </div>

          <div className="exploreFilterGroup">
            <div className="exploreFilterGroup__label">Price</div>
            <div className="exploreChipRow">
              {PRICE_OPTIONS.map((price) => (
                <button key={price} type="button"
                  className={`quickFilterBtn ${filters.priceRange.includes(price) ? "is-active" : ""}`}
                  onClick={() => toggleArrayFilter("priceRange", price)}
                  aria-pressed={filters.priceRange.includes(price)}
                >{price}</button>
              ))}
            </div>
          </div>

          <div className="exploreFilterGroup">
            <div className="exploreFilterGroup__label">Dietary</div>
            <div className="exploreChipRow">
              {DIETARY_OPTIONS.map((dietary) => (
                <button key={dietary} type="button"
                  className={`quickFilterBtn ${filters.dietarySupport.includes(dietary) ? "is-active" : ""}`}
                  onClick={() => toggleArrayFilter("dietarySupport", dietary)}
                  aria-pressed={filters.dietarySupport.includes(dietary)}
                >{dietary}</button>
              ))}
            </div>
          </div>

          <div className="exploreFilterGroup">
            <div className="exploreFilterGroup__label">Rating</div>
            <div className="exploreChipRow">
              {RATING_OPTIONS.map((option) => (
                <button key={option.label} type="button"
                  className={`quickFilterBtn ${Number(filters.minRating) === option.value ? "is-active" : ""}`}
                  onClick={() => setFilters((prev) => ({ ...prev, minRating: option.value }))}
                  aria-pressed={Number(filters.minRating) === option.value}
                >{option.label}</button>
              ))}
              <button type="button"
                className={`quickFilterBtn ${filters.openNow ? "is-active" : ""}`}
                onClick={() => setFilters((prev) => ({ ...prev, openNow: !prev.openNow }))}
                aria-pressed={filters.openNow}
              >Open Now</button>
            </div>
          </div>

          <label className="field">
            <span>Distance: {filters.distanceRadius} km</span>
            <input type="range" min="1" max="50" step="1"
              value={filters.distanceRadius}
              onChange={(e) => setFilters((prev) => ({ ...prev, distanceRadius: Number(e.target.value) }))}
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

        {/* Right: Mapbox map */}
        <div className="exploreMapWrapper">
          <Map
            {...viewState}
            onMove={(evt) => setViewState(evt.viewState)}
            mapboxAccessToken={MAPBOX_TOKEN}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
          >
            <NavigationControl position="top-right" />

            {/* Blue dot — only shows when browser GPS has granted a fix */}
            {gpsCoords.lat != null && gpsCoords.lng != null && (
              <Marker
                longitude={gpsCoords.lng}
                latitude={gpsCoords.lat}
                anchor="center"
              >
                <div className="exploreUserDot" />
              </Marker>
            )}

            {/* Restaurant name-pill markers */}
            {restaurantsWithCoords.map((restaurant) => {
              const lat = parseCoord(restaurant.latitude);
              const lng = parseCoord(restaurant.longitude);
              if (lat == null || lng == null) return null;
              const label = restaurant.name.length > 16
                ? restaurant.name.slice(0, 16) + "…"
                : restaurant.name;
              return (
                <Marker
                  key={`marker-${restaurant.id}`}
                  longitude={lng}
                  latitude={lat}
                  anchor="bottom"
                >
                  <div
                    className={`exploreMarker__pill${selectedRestaurantId === restaurant.id ? " is-selected" : ""}`}
                    onClick={() => handleSelectRestaurant(restaurant.id)}
                  >
                    {label}
                  </div>
                </Marker>
              );
            })}
          </Map>
        </div>
      </div>
    </div>
  );
}
