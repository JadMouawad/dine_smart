import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthContext.jsx";
import { searchRestaurants, getRestaurantById } from "../../services/restaurantService";
import { getFavorites, addFavorite, removeFavorite } from "../../services/favoriteService";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import SearchFilterDrawer from "./SearchFilterDrawer.jsx";
import RestaurantDetailPanel from "./RestaurantDetailPanel.jsx";
import { getTodayDateValue, isOpenNow } from "../../utils/timeUtils";
import { CUISINES, DIETARY_OPTIONS, PRICE_OPTIONS, PRICE_LABELS, DIETARY_LABELS, FILLED_STAR } from "../../constants/filters";

// ── Constants ──────────────────────────────────────────────────────────────
const DEFAULT_BEIRUT_GEO = { latitude: 33.8938, longitude: 35.5018 };

function parseDietarySupport(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  const normalized = value.trim();
  if (!normalized) return [];
  if (normalized.startsWith("{") && normalized.endsWith("}")) {
    return normalized.slice(1, -1).split(",").map((i) => i.replace(/^"|"$/g, "").trim()).filter(Boolean);
  }
  return normalized.split(",").map((i) => i.trim()).filter(Boolean);
}

function getRestaurantGalleryUrls(restaurant) {
  const rawGallery = Array.isArray(restaurant?.gallery_urls)
    ? restaurant.gallery_urls
    : Array.isArray(restaurant?.galleryUrls)
      ? restaurant.galleryUrls
      : [];

  const cleanedGallery = rawGallery
    .map((url) => String(url || "").trim())
    .filter(Boolean);

  if (cleanedGallery.length) return cleanedGallery;

  const fallbackImage = [
    restaurant?.coverUrl,
    restaurant?.cover_url,
    restaurant?.logoUrl,
    restaurant?.logo_url,
  ]
    .map((url) => String(url || "").trim())
    .find(Boolean);

  return fallbackImage ? [fallbackImage] : [];
}

function getInitialFilters() {
  return {
    minRating: 0,
    priceRange: [],
    dietarySupport: [],
    openNow: false,
    verifiedOnly: true,
    availabilityDate: "",
    availabilityTime: "",
    distanceEnabled: false,
    distanceRadius: 25,
    cuisines: [],
    sortBy: "rating",
  };
}

// ── Memoized restaurant card ───────────────────────────────────────────────
const RestaurantCard = React.memo(function RestaurantCard({ r, isFavorited, onSelect, onFavorite, onReserve }) {
  const imageUrls = useMemo(() => getRestaurantGalleryUrls(r), [r]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const activeImageUrl = imageUrls[activeImageIndex] || "";

  useEffect(() => {
    if (!imageUrls.length) {
      setActiveImageIndex(0);
      return;
    }
    setActiveImageIndex((prev) => {
      if (prev < 0) return 0;
      if (prev >= imageUrls.length) return imageUrls.length - 1;
      return prev;
    });
  }, [imageUrls]);

  const showPrevImage = (event) => {
    event.stopPropagation();
    if (imageUrls.length <= 1) return;
    setActiveImageIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
  };

  const showNextImage = (event) => {
    event.stopPropagation();
    if (imageUrls.length <= 1) return;
    setActiveImageIndex((prev) => (prev + 1) % imageUrls.length);
  };

  return (
    <article className="restaurantCard restaurantCard--search" onClick={() => onSelect(r)}>
      <div className="restaurantCard__cover">
        {activeImageUrl ? (
          <>
            <img className="restaurantCard__coverImg" src={activeImageUrl} alt={`${r.name} cover`} loading="lazy" />
            {imageUrls.length > 1 && (
              <>
                <button
                  type="button"
                  className="restaurantCard__coverArrow restaurantCard__coverArrow--left"
                  onClick={showPrevImage}
                  aria-label="Previous image"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="restaurantCard__coverArrow restaurantCard__coverArrow--right"
                  onClick={showNextImage}
                  aria-label="Next image"
                >
                  ›
                </button>
                <div className="restaurantCard__coverIndex">
                  {activeImageIndex + 1}/{imageUrls.length}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="restaurantCard__coverPlaceholder">No image</div>
        )}
      </div>
      <div className="restaurantCard__body">
        <div className="restaurantCard__header">
          <div className="restaurantCard__name">{r.name}</div>
          <button
            className={`favoriteHeartBtn ${isFavorited ? "is-active" : ""}`}
            type="button"
            onClick={(e) => { e.stopPropagation(); onFavorite(r); }}
            aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            <svg viewBox="0 0 24 24" className="favoriteHeartIcon" aria-hidden="true">
              <path d="M12 21s-7.2-4.6-9.6-9C.7 8.7 2.1 5.5 5.4 4.6c1.8-.5 3.6.1 4.8 1.4L12 7.8l1.8-1.8c1.2-1.3 3-1.9 4.8-1.4 3.3.9 4.7 4.1 3 7.4C19.2 16.4 12 21 12 21z" />
            </svg>
          </button>
        </div>
        <div className="restaurantCard__cuisine">{r.cuisine || "Cuisine not set"}</div>
        <div className="restaurantCard__metaLine">{FILLED_STAR} {r.rating ?? "N/A"}</div>
        <div className="restaurantCard__metaLine">
          {r.distance_km != null ? `${r.distance_km} km away` : (r.address || "Location unavailable")}
        </div>
        <div className="restaurantCard__actions">
          <button
            className="btn btn--gold reserveMiniBtn"
            type="button"
            onClick={(e) => { e.stopPropagation(); onReserve(r); }}
          >Reserve</button>
        </div>
      </div>
    </article>
  );
});

// ── Component ──────────────────────────────────────────────────────────────
export default function UserSearch({
  isGuest = false,
  onRequireSignup,
  restaurantToOpen,
  clearRestaurantToOpen,
  onSearchActiveChange,
  initialCuisine = "",
  initialCuisineToken = 0,
}) {
  const { user } = useAuth();

  // Search state
  const [query, setQuery] = useState("");
  const [restaurants, setRestaurants] = useState([]);
  const [baseRestaurants, setBaseRestaurants] = useState([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [restaurantsError, setRestaurantsError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Detail view
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [restaurantNotFound, setRestaurantNotFound] = useState(false);

  // Filter drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState(getInitialFilters());

  // Sort
  const [sortOpen, setSortOpen] = useState(false);

  // Geo
  const [geo, setGeo] = useState({ latitude: null, longitude: null });

  // Favorites (server-backed)
  const [favorites, setFavorites] = useState([]);

  const scrollRestoreRef = useRef(null);

  // ── Auth guard ────────────────────────────────────────────
  function requireAuth() {
    if (isGuest || !user?.id) { onRequireSignup?.(); return false; }
    return true;
  }

  // ── Filter helpers ────────────────────────────────────────
  function updateFilters(updater, preserveScroll = true) {
    if (preserveScroll) scrollRestoreRef.current = window.scrollY;
    setFilters((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }

  function resetFilters() { updateFilters(getInitialFilters()); }
  function retryRestaurants() { setRefreshKey((prev) => prev + 1); }

  // ── Favorites (API-backed, optimistic) ───────────────────
  function isFavorited(restaurantId) { return favorites.some((r) => r.id === restaurantId); }

  function toggleFavorite(restaurant) {
    const alreadyFavorited = isFavorited(restaurant.id);
    // Update UI immediately — never revert so the heart always responds
    setFavorites((prev) =>
      alreadyFavorited ? prev.filter((r) => r.id !== restaurant.id) : [...prev, restaurant]
    );
    const apiCall = alreadyFavorited ? removeFavorite(restaurant.id) : addFavorite(restaurant.id);
    apiCall.catch((err) => {
      console.error("[favorites]", err?.message);
      toast.error(alreadyFavorited ? "Couldn't remove favorite." : "Couldn't save favorite — check your connection.");
    });
  }

  // ── Geo ───────────────────────────────────────────────────
  const profileGeo = useMemo(() => {
    const latitude = Number(user?.latitude);
    const longitude = Number(user?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { latitude: null, longitude: null };
    return { latitude, longitude };
  }, [user?.latitude, user?.longitude]);

  const effectiveGeo = useMemo(() => {
    if (geo.latitude != null && geo.longitude != null) return { latitude: geo.latitude, longitude: geo.longitude };
    if (profileGeo.latitude != null && profileGeo.longitude != null) return profileGeo;
    return DEFAULT_BEIRUT_GEO;
  }, [geo.latitude, geo.longitude, profileGeo]);

  // ── Derived ───────────────────────────────────────────────
  const filteredRestaurants = useMemo(() => {
    const list = Array.isArray(restaurants) ? [...restaurants] : [];
    const sortBy = String(filters.sortBy || "rating").toLowerCase();
    const toNum = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
    if (sortBy === "alphabetical") return list.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
    if (sortBy === "distance") return list.sort((a, b) => { const ad = toNum(a?.distance_km, Number.MAX_SAFE_INTEGER), bd = toNum(b?.distance_km, Number.MAX_SAFE_INTEGER); return ad !== bd ? ad - bd : toNum(b?.rating) - toNum(a?.rating); });
    if (sortBy === "reviews") return list.sort((a, b) => { const ar = toNum(a?.review_count), br = toNum(b?.review_count); return ar !== br ? br - ar : toNum(b?.rating) - toNum(a?.rating); });
    if (sortBy === "popularity") return list.sort((a, b) => { const ap = toNum(a?.popularity_score), bp = toNum(b?.popularity_score); return ap !== bp ? bp - ap : toNum(b?.rating) - toNum(a?.rating); });
    return list.sort((a, b) => { const ar = toNum(a?.rating), br = toNum(b?.rating); return ar !== br ? br - ar : String(a?.name || "").localeCompare(String(b?.name || "")); });
  }, [restaurants, filters.sortBy]);

  const optionCounts = useMemo(() => {
    const counts = {
      cuisine: Object.fromEntries(CUISINES.map((c) => [c, 0])),
      price: Object.fromEntries(PRICE_OPTIONS.map((p) => [p, 0])),
      dietary: Object.fromEntries(DIETARY_OPTIONS.map((d) => [d, 0])),
      topRated: 0, openNow: 0, availableToday: 0,
    };
    const today = getTodayDateValue();
    baseRestaurants.forEach((r) => {
      if (counts.cuisine[r.cuisine] != null) counts.cuisine[r.cuisine] += 1;
      if (counts.price[r.price_range] != null) counts.price[r.price_range] += 1;
      parseDietarySupport(r.dietary_support).forEach((d) => { if (counts.dietary[d] != null) counts.dietary[d] += 1; });
      if (Number(r.rating || 0) >= 4) counts.topRated += 1;
      if (isOpenNow(r.opening_time ?? r.openingTime, r.closing_time ?? r.closingTime)) counts.openNow += 1;
      if (today) counts.availableToday += 1;
    });
    return counts;
  }, [baseRestaurants]);

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (filters.minRating > 0) chips.push({ key: "min", label: `Rating >= ${filters.minRating}`, clear: () => updateFilters((p) => ({ ...p, minRating: 0 })) });
    if (filters.openNow) chips.push({ key: "open", label: "Open Now", clear: () => updateFilters((p) => ({ ...p, openNow: false })) });
    if (filters.availabilityDate) chips.push({ key: "date", label: `Date: ${filters.availabilityDate}`, clear: () => updateFilters((p) => ({ ...p, availabilityDate: "", availabilityTime: "" })) });
    if (filters.availabilityTime) chips.push({ key: "time", label: `Time: ${filters.availabilityTime}`, clear: () => updateFilters((p) => ({ ...p, availabilityTime: "" })) });
    if (filters.distanceEnabled) chips.push({ key: "distance", label: `Distance: ${filters.distanceRadius}km`, clear: () => updateFilters((p) => ({ ...p, distanceEnabled: false })) });
    if (filters.sortBy && filters.sortBy !== "rating") {
      const labels = { distance: "Distance", reviews: "Reviews", popularity: "Popularity", alphabetical: "A-Z" };
      chips.push({ key: "sort", label: `Sort: ${labels[filters.sortBy] || filters.sortBy}`, clear: () => updateFilters((p) => ({ ...p, sortBy: "rating" })) });
    }
    filters.priceRange.forEach((p) => chips.push({ key: `price-${p}`, label: `Price: ${PRICE_LABELS[p] || p}`, clear: () => updateFilters((prev) => ({ ...prev, priceRange: prev.priceRange.filter((x) => x !== p) })) }));
    filters.dietarySupport.forEach((d) => chips.push({ key: `dietary-${d}`, label: DIETARY_LABELS[d] || d, clear: () => updateFilters((prev) => ({ ...prev, dietarySupport: prev.dietarySupport.filter((x) => x !== d) })) }));
    filters.cuisines.forEach((c) => chips.push({ key: `cuisine-${c}`, label: c, clear: () => updateFilters((prev) => ({ ...prev, cuisines: prev.cuisines.filter((x) => x !== c) })) }));
    return chips;
  }, [filters]);

  const sortOptions = [
    { value: "rating", label: "Top Rated" },
    { value: "distance", label: "Nearest" },
    { value: "reviews", label: "Most Reviewed" },
    { value: "popularity", label: "Most Popular" },
    { value: "alphabetical", label: "A-Z" },
  ];

  // ── Effects ───────────────────────────────────────────────

  // Fetch restaurants
  useEffect(() => {
    let cancelled = false;
    setRestaurantsLoading(true);
    setRestaurantsError("");
    const payload = {
      minRating: filters.minRating,
      priceRange: filters.priceRange,
      dietarySupport: filters.dietarySupport,
      openNow: filters.openNow,
      verifiedOnly: filters.verifiedOnly,
      availabilityDate: filters.availabilityDate || null,
      availabilityTime: filters.availabilityTime || null,
      latitude: effectiveGeo.latitude,
      longitude: effectiveGeo.longitude,
      distanceRadius: filters.distanceEnabled ? filters.distanceRadius : null,
      sortBy: filters.sortBy,
    };
    Promise.all([
      searchRestaurants(query.trim(), filters.cuisines, payload),
      searchRestaurants(query.trim(), [], { verifiedOnly: true, latitude: effectiveGeo.latitude, longitude: effectiveGeo.longitude }),
    ])
      .then(([filtered, base]) => {
        if (cancelled) return;
        setRestaurants(Array.isArray(filtered) ? filtered : []);
        setBaseRestaurants(Array.isArray(base) ? base : []);
      })
      .catch(() => { if (cancelled) return; setRestaurants([]); setBaseRestaurants([]); setRestaurantsError("We couldn't load restaurants. Check your connection and try again."); })
      .finally(() => { if (!cancelled) setRestaurantsLoading(false); });
    return () => { cancelled = true; };
  }, [query, filters, effectiveGeo.latitude, effectiveGeo.longitude, refreshKey]);

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ latitude: Number(pos.coords.latitude.toFixed(6)), longitude: Number(pos.coords.longitude.toFixed(6)) }),
      () => setGeo({ latitude: null, longitude: null }),
      { timeout: 7000 }
    );
  }, []);

  // Load favorites from server
  useEffect(() => {
    if (!user?.id) return;
    getFavorites()
      .then((data) => setFavorites(Array.isArray(data) ? data : []))
      .catch(() => setFavorites([]));
  }, [user?.id]);

  // Seed cuisine from external nav
  useEffect(() => {
    const preset = String(initialCuisine || "").trim();
    if (!preset) return;
    setFilters((prev) => ({ ...prev, cuisines: [preset] }));
  }, [initialCuisineToken, initialCuisine]);

  // Open restaurant passed from Discover / Explore
  useEffect(() => {
    if (!restaurantToOpen) return;
    setRestaurantNotFound(false);
    if (restaurantToOpen.name != null) {
      setSelectedRestaurant(restaurantToOpen);
      clearRestaurantToOpen?.();
      return;
    }
    const id = restaurantToOpen.id ?? restaurantToOpen;
    getRestaurantById(id)
      .then((r) => setSelectedRestaurant(r))
      .catch(() => setRestaurantNotFound(true))
      .finally(() => clearRestaurantToOpen?.());
  }, [restaurantToOpen, clearRestaurantToOpen]);

  // Scroll restore after filter change
  useEffect(() => {
    if (scrollRestoreRef.current == null) return;
    const restoreTo = scrollRestoreRef.current;
    scrollRestoreRef.current = null;
    window.requestAnimationFrame(() => window.scrollTo({ top: restoreTo, behavior: "auto" }));
  }, [restaurants]);

  // Notify parent when search is active (used by the landing page)
  useEffect(() => {
    const initial = getInitialFilters();
    const active =
      query.trim().length > 0
      || filters.minRating !== initial.minRating
      || filters.openNow !== initial.openNow
      || filters.verifiedOnly !== initial.verifiedOnly
      || filters.availabilityDate !== initial.availabilityDate
      || filters.availabilityTime !== initial.availabilityTime
      || filters.distanceEnabled !== initial.distanceEnabled
      || Number(filters.distanceRadius) !== Number(initial.distanceRadius)
      || filters.sortBy !== initial.sortBy
      || filters.priceRange.length > 0
      || filters.dietarySupport.length > 0
      || filters.cuisines.length > 0;
    onSearchActiveChange?.(active);
  }, [query, filters, onSearchActiveChange]);

  // Disable sticky nav while inside restaurant detail
  useEffect(() => {
    const inDetails = !!selectedRestaurant;
    document.body.classList.toggle("ds-nav-not-sticky", inDetails);
    return () => document.body.classList.remove("ds-nav-not-sticky");
  }, [selectedRestaurant]);


  // ── Render: not found ─────────────────────────────────────
  if (restaurantNotFound) {
    return (
      <div className="userSearchPage">
        <div className="formCard formCard--userProfile userSearchNotFoundCard">
          <button
            type="button"
            className="btn btn--ghost backArrowBtn backArrowBtn--topLeftInCard"
            onClick={() => setRestaurantNotFound(false)}
            aria-label="Go back"
          >←</button>
          <p className="userSearchNotFoundCard__text">Restaurant not found or no longer available.</p>
        </div>
      </div>
    );
  }

  // ── Render: detail view ───────────────────────────────────
  if (selectedRestaurant) {
    return (
      <RestaurantDetailPanel
        restaurant={selectedRestaurant}
        isFavorited={isFavorited}
        onToggleFavorite={toggleFavorite}
        requireAuth={requireAuth}
        onBack={() => { setSelectedRestaurant(null); setRestaurantNotFound(false); }}
      />
    );
  }

  // ── Render: search list ───────────────────────────────────
  return (
    <div className="userSearchPage">
      <h1 className="userSearchPage__title">Search Restaurants</h1>

      <div className="searchBarCard">
        <input
          className="searchInput"
          type="text"
          placeholder="Search by name, cuisine, or keyword"
          value={query}
          onChange={(e) => { scrollRestoreRef.current = window.scrollY; setQuery(e.target.value); }}
          aria-label="Search restaurants"
        />
        <button
          type="button"
          className={`searchFilterBtn${activeFilterChips.length > 0 ? " is-active" : ""}`}
          onClick={() => setDrawerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
        >
          ⚙ Filters
          {activeFilterChips.length > 0 && (
            <span className="searchFilterBtn__badge">{activeFilterChips.length}</span>
          )}
        </button>
      </div>

      {activeFilterChips.length > 0 && (
        <div className="activeFilterChips" aria-label="Active filters">
          {activeFilterChips.map((chip) => (
            <button key={chip.key} type="button" className="activeFilterChip" onClick={chip.clear}>
              {chip.label}
              <span className="activeFilterChip__x" aria-hidden="true">✕</span>
            </button>
          ))}
          <button className="btn btn--ghost" type="button" onClick={resetFilters}>Reset Filters</button>
        </div>
      )}

      <div className="searchResultsHeader">
        <p className="searchResultsHeader__count">{filteredRestaurants.length} restaurants found</p>
        <div className="searchSortControl">
          <span>Sort by</span>
          <div className="sortDropdown">
            <button
              type="button"
              className="sortDropdown__btn"
              onClick={() => setSortOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
            >
              {sortOptions.find((o) => o.value === filters.sortBy)?.label || "Top Rated"}
              <span className="sortDropdown__arrow">▾</span>
            </button>
            {sortOpen && (
              <>
                <div className="sortDropdown__backdrop" onClick={() => setSortOpen(false)} />
                <div className="sortDropdown__menu" role="listbox">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={filters.sortBy === option.value}
                      className={`sortDropdown__item${filters.sortBy === option.value ? " is-active" : ""}`}
                      onClick={() => { updateFilters((prev) => ({ ...prev, sortBy: option.value })); setSortOpen(false); }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="restaurantGrid">
        {restaurantsLoading ? (
          <LoadingSkeleton variant="card" count={8} className="restaurantGridSkeleton" />
        ) : restaurantsError ? (
          <EmptyState
            title="We couldn't load restaurants"
            message={restaurantsError}
            actionLabel="Try Again"
            onAction={retryRestaurants}
          />
        ) : filteredRestaurants.length === 0 ? (
          <EmptyState
            title="No restaurants match your filters"
            message="Try adjusting filters or reset to browse all available restaurants."
            actionLabel="Reset Filters"
            onAction={resetFilters}
          />
        ) : null}
        {!restaurantsLoading && filteredRestaurants.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: i * 0.04, ease: "easeOut" }}
          >
            <RestaurantCard
              r={r}
              isFavorited={isFavorited(r.id)}
              onSelect={(restaurant) => setSelectedRestaurant(restaurant)}
              onFavorite={(restaurant) => { if (!requireAuth()) return; toggleFavorite(restaurant); }}
              onReserve={(restaurant) => { if (!requireAuth()) return; setSelectedRestaurant(restaurant); }}
            />
          </motion.div>
        ))}
      </div>

      <SearchFilterDrawer
        isOpen={drawerOpen}
        initialFilters={filters}
        effectiveGeo={effectiveGeo}
        optionCounts={optionCounts}
        onClose={() => setDrawerOpen(false)}
        onApply={(newFilters) => { updateFilters(newFilters); setDrawerOpen(false); }}
      />
    </div>
  );
}
