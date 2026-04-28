import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import * as recentSearchService from "../../services/recentSearchService";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthContext.jsx";
import { searchRestaurants, getRestaurantById } from "../../services/restaurantService";
import { getDiscoverRecommendations } from "../../services/recommendationService.js";
import { getFavorites, addFavorite, removeFavorite } from "../../services/favoriteService";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import SearchFilterDrawer from "./SearchFilterDrawer.jsx";
import RestaurantDetailPanel from "./RestaurantDetailPanel.jsx";
import { getTodayDateValue, isOpenNow } from "../../utils/timeUtils";
import { getCrowdMeterMeta } from "../../utils/crowdMeter";
import { CUISINES, DIETARY_OPTIONS, PRICE_OPTIONS, PRICE_LABELS, DIETARY_LABELS, FILLED_STAR } from "../../constants/filters";
import ThemedSelect from "../../components/ThemedSelect.jsx";

// ── Recent Searches (localStorage) ────────────────────────────────────────
const RECENT_KEY = "dinesmart_recent_searches";
const MAX_RECENT = 5;
const RESTAURANT_DETAIL_HISTORY_KEY = "dinesmartRestaurantDetailId";

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function addRecentSearch(query) {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return;
  const existing = getRecentSearches().filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
  const updated = [trimmed, ...existing].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
}

function removeRecentSearch(query) {
  const updated = getRecentSearches().filter((q) => q !== query);
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_KEY);
}

// ── Constants ──────────────────────────────────────────────────────────────
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

function withoutRestaurantDetailHistory(state) {
  if (!state || typeof state !== "object") return {};
  const nextState = { ...state };
  delete nextState[RESTAURANT_DETAIL_HISTORY_KEY];
  return nextState;
}

function getSafeReviewCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function getInitialFilters() {
  return {
    minRating: 0,
    priceRange: [],
    dietarySupport: [],
    openNow: false,
    verifiedOnly: false,
    availabilityDate: "",
    availabilityTime: "",
    distanceEnabled: false,
    distanceRadius: 25,
    cuisines: [],
    sortBy: "rating",
  };
}

// ── Memoized restaurant card ───────────────────────────────────────────────
const RestaurantCard = React.memo(function RestaurantCard({ r, isFavorited, isRecommended, showDistance, onSelect, onFavorite, onReserve }) {
  const imageUrls = useMemo(() => getRestaurantGalleryUrls(r), [r]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const safeActiveImageIndex = imageUrls.length
    ? Math.max(0, Math.min(activeImageIndex, imageUrls.length - 1))
    : 0;
  const activeImageUrl = imageUrls[safeActiveImageIndex] || "";
  const crowd = useMemo(() => getCrowdMeterMeta(r), [r]);
  const reviewCount = useMemo(() => getSafeReviewCount(r?.review_count), [r]);
  const ratingDisplay = r?.rating ?? "N/A";

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
        {isRecommended && (
          <span className="restaurantCard__recommendedBadge restaurantCard__recommendedBadge--cover">Recommended</span>
        )}
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
                  {safeActiveImageIndex + 1}/{imageUrls.length}
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
          <div className="restaurantCard__titleBlock">
            <div className="restaurantCard__name">
              {r.name}
              {r.certificate_verified && (
                <span className="verifiedBadge" title="Verified Restaurant">
                  <svg className="verifiedBadge__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Verified">
                    <circle cx="12" cy="12" r="12" fill="#1877F2"/>
                    <path d="M7 12.5l3.5 3.5 6.5-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              )}
            </div>
          </div>
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
        <div className={`crowdMeter crowdMeter--${crowd.level}`}>
          <span className="crowdMeter__dot" />
          <span>Live Crowd: {crowd.label}{crowd.pct != null ? ` (${crowd.pct}%)` : ""}</span>
        </div>
        <div className="restaurantCard__metaLine">{FILLED_STAR} {ratingDisplay} ({reviewCount})</div>
        <div className={`restaurantCard__metaLine ${showDistance && r.distance_km != null ? "restaurantCard__locationLine" : ""}`}>
          {showDistance && r.distance_km != null ? (
            <>
              <span className="restaurantCard__address">{r.address || "Location unavailable"}</span>
              <span className="restaurantCard__distance">{r.distance_km} km away</span>
            </>
          ) : (
            r.address || "Location unavailable"
          )}
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
  chatCommand,
  clearChatCommand,
  onSearchActiveChange,
  initialCuisine = "",
  initialCuisineToken = 0,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state && typeof location.state === "object" ? location.state : {};
  const detailHistoryRestaurantId = locationState[RESTAURANT_DETAIL_HISTORY_KEY] ?? null;

  // Search state
  const [query, setQuery] = useState("");
  const [restaurants, setRestaurants] = useState([]);
  const [baseRestaurants, setBaseRestaurants] = useState([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [restaurantsError, setRestaurantsError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Detail view
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [selectedRestaurantDetailsLoading, setSelectedRestaurantDetailsLoading] = useState(false);
  const [selectedRestaurantDetailsError, setSelectedRestaurantDetailsError] = useState("");
  const [restaurantNotFound, setRestaurantNotFound] = useState(false);
  const [reservationIntentToken, setReservationIntentToken] = useState(0);

  // Filter drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState(getInitialFilters());

  // Sort
  // Geo
  const [geo, setGeo] = useState({ latitude: null, longitude: null });

  // Favorites (server-backed)
  const [favorites, setFavorites] = useState([]);
  const [recommendedRestaurantIds, setRecommendedRestaurantIds] = useState([]);

  const scrollRestoreRef = useRef(null);

  // Recent searches
  const [recentSearches, setRecentSearches] = useState([]);
  const [showRecent, setShowRecent] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const searchBarRef = useRef(null);
  const dropdownRef = useRef(null);
  const lastQueryRef = useRef("");
  const selectedRestaurantRequestRef = useRef(0);

  // Load recent searches (DB for logged-in, localStorage for guests)
  useEffect(() => {
    if (user?.id) {
      recentSearchService.getRecentSearches()
        .then((data) => setRecentSearches(Array.isArray(data) ? data : []))
        .catch(() => setRecentSearches(getRecentSearches().map((q) => ({ query: q }))));
    } else {
      setRecentSearches(getRecentSearches().map((q) => ({ query: q })));
    }
  }, [user?.id]);

  const saveRecentSearch = useCallback((q) => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 2) return;
    if (user?.id) {
      recentSearchService.addRecentSearch(trimmed)
        .then(() => recentSearchService.getRecentSearches())
        .then((data) => setRecentSearches(Array.isArray(data) ? data : []))
        .catch(() => {});
    } else {
      addRecentSearch(trimmed);
      setRecentSearches(getRecentSearches().map((q2) => ({ query: q2 })));
    }
  }, [user?.id]);

  // Track the longest query typed — only grows, never shrinks during deletion
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length > lastQueryRef.current.length) lastQueryRef.current = trimmed;
  }, [query]);

  // Save on unmount (user switches section)
  const saveRecentSearchRef = useRef(saveRecentSearch);
  useEffect(() => { saveRecentSearchRef.current = saveRecentSearch; }, [saveRecentSearch]);
  useEffect(() => {
    return () => { if (lastQueryRef.current) saveRecentSearchRef.current(lastQueryRef.current); };
  }, []);


  // Close dropdown when clicking outside both the search bar AND the dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      const inSearchBar = searchBarRef.current?.contains(e.target);
      const inDropdown = dropdownRef.current?.contains(e.target);
      if (!inSearchBar && !inDropdown) setShowRecent(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Recalculate dropdown position on scroll/resize
  useEffect(() => {
    if (!showRecent) return;
    const update = () => {
      if (!searchBarRef.current) return;
      const rect = searchBarRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: Math.min(rect.width, 400) });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [showRecent]);

  const handleSelectRecent = useCallback((q) => {
    setQuery(q);
    setShowRecent(false);
  }, []);

  const handleRemoveRecent = useCallback((e, item) => {
    e.stopPropagation();
    if (user?.id && item.id) {
      recentSearchService.removeRecentSearch(item.id)
        .then(() => recentSearchService.getRecentSearches())
        .then((data) => setRecentSearches(Array.isArray(data) ? data : []))
        .catch(() => {});
    } else {
      removeRecentSearch(item.query);
      setRecentSearches(getRecentSearches().map((q) => ({ query: q })));
    }
  }, [user?.id]);

  const handleClearRecent = useCallback(() => {
    // Clear UI immediately — don't wait for API
    setRecentSearches([]);
    setShowRecent(false);
    clearRecentSearches(); // always clear localStorage too
    if (user?.id) {
      recentSearchService.clearRecentSearches()
        .catch((err) => console.warn("Failed to clear recent searches:", err));
    }
  }, [user?.id]);

  function requireAuth() {
    if (isGuest || !user?.id) { onRequireSignup?.(); return false; }
    return true;
  }

  function updateFilters(updater, preserveScroll = true) {
    if (preserveScroll) scrollRestoreRef.current = window.scrollY;
    setFilters((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }

  function resetFilters() { updateFilters(getInitialFilters()); }
  function retryRestaurants() { setRefreshKey((prev) => prev + 1); }

  function isFavorited(restaurantId) { return favorites.some((r) => r.id === restaurantId); }

  function pushRestaurantDetailHistory(restaurantId) {
    if (restaurantId == null) return false;
    const nextId = String(restaurantId);
    if (String(detailHistoryRestaurantId || "") === nextId) return false;
    navigate(".", {
      replace: false,
      state: {
        ...locationState,
        [RESTAURANT_DETAIL_HISTORY_KEY]: nextId,
      },
    });
    return true;
  }

  function replaceRestaurantDetailHistory() {
    if (detailHistoryRestaurantId == null) return;
    navigate(".", {
      replace: true,
      state: withoutRestaurantDetailHistory(locationState),
    });
  }

  function clearSelectedRestaurantDetails() {
    selectedRestaurantRequestRef.current += 1;
    setSelectedRestaurant(null);
    setSelectedRestaurantDetailsLoading(false);
    setSelectedRestaurantDetailsError("");
    setRestaurantNotFound(false);
  }

  function openRestaurantDetails(restaurant, { reserve = false, pushHistory = true } = {}) {
    if (!restaurant?.id) {
      setSelectedRestaurant(restaurant);
      setSelectedRestaurantDetailsLoading(false);
      setSelectedRestaurantDetailsError("");
      return;
    }

    if (pushHistory) {
      pushRestaurantDetailHistory(restaurant.id);
    }

    const requestId = selectedRestaurantRequestRef.current + 1;
    selectedRestaurantRequestRef.current = requestId;
    setRestaurantNotFound(false);
    setSelectedRestaurant(restaurant);
    setSelectedRestaurantDetailsLoading(true);
    setSelectedRestaurantDetailsError("");
    if (reserve) {
      setReservationIntentToken((prev) => prev + 1);
    }

    getRestaurantById(restaurant.id)
      .then((fullRestaurant) => {
        if (selectedRestaurantRequestRef.current !== requestId) return;
        setSelectedRestaurant((current) =>
          current && String(current.id) === String(restaurant.id)
            ? fullRestaurant
            : current
        );
        setSelectedRestaurantDetailsError("");
      })
      .catch(() => {
        if (selectedRestaurantRequestRef.current !== requestId) return;
        setSelectedRestaurantDetailsError("Menu is temporarily unavailable.");
        // Keep the lightweight search result open if the details request fails.
      })
      .finally(() => {
        if (selectedRestaurantRequestRef.current === requestId) {
          setSelectedRestaurantDetailsLoading(false);
        }
      });
  }

  function handleRestaurantDetailBack() {
    if (detailHistoryRestaurantId != null) {
      navigate(-1);
      return;
    }
    clearSelectedRestaurantDetails();
  }

  useEffect(() => {
    const stateRestaurantId = detailHistoryRestaurantId != null
      ? String(detailHistoryRestaurantId)
      : "";

    if (!stateRestaurantId) {
      if (selectedRestaurant) clearSelectedRestaurantDetails();
      return;
    }

    if (selectedRestaurant && String(selectedRestaurant.id) === stateRestaurantId) return;

    const lightweightRestaurant = restaurants.find((entry) => String(entry?.id) === stateRestaurantId);
    if (lightweightRestaurant) {
      openRestaurantDetails(lightweightRestaurant, { pushHistory: false });
      return;
    }

    const requestId = selectedRestaurantRequestRef.current + 1;
    selectedRestaurantRequestRef.current = requestId;
    setRestaurantNotFound(false);
    setSelectedRestaurantDetailsLoading(true);
    setSelectedRestaurantDetailsError("");

    getRestaurantById(stateRestaurantId)
      .then((restaurant) => {
        if (selectedRestaurantRequestRef.current !== requestId) return;
        setSelectedRestaurant(restaurant);
      })
      .catch(() => {
        if (selectedRestaurantRequestRef.current === requestId) setRestaurantNotFound(true);
      })
      .finally(() => {
        if (selectedRestaurantRequestRef.current === requestId) {
          setSelectedRestaurantDetailsLoading(false);
        }
      });
  }, [detailHistoryRestaurantId]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleFavorite(restaurant) {
    const alreadyFavorited = isFavorited(restaurant.id);
    setFavorites((prev) =>
      alreadyFavorited ? prev.filter((r) => r.id !== restaurant.id) : [...prev, restaurant]
    );
    const apiCall = alreadyFavorited ? removeFavorite(restaurant.id) : addFavorite(restaurant.id);
    apiCall.catch((err) => {
      console.error("[favorites]", err?.message);
      const fallbackMessage = alreadyFavorited ? "Couldn't remove favorite." : "Couldn't save favorite.";
      toast.error(err?.message ? `${fallbackMessage} ${err.message}` : fallbackMessage);
    });
  }

  const profileGeo = useMemo(() => {
    const latitude = Number(user?.latitude);
    const longitude = Number(user?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { latitude: null, longitude: null };
    return { latitude, longitude };
  }, [user?.latitude, user?.longitude]);

  const effectiveGeo = useMemo(() => {
    if (!user?.id) return { latitude: null, longitude: null };
    if (geo.latitude != null && geo.longitude != null) return { latitude: geo.latitude, longitude: geo.longitude };
    if (profileGeo.latitude != null && profileGeo.longitude != null) return profileGeo;
    return { latitude: null, longitude: null };
  }, [user?.id, geo.latitude, geo.longitude, profileGeo]);

  const showRestaurantDistance = Boolean(
    user?.id &&
    filters.distanceEnabled &&
    effectiveGeo.latitude != null &&
    effectiveGeo.longitude != null
  );
  const recommendedRestaurantSet = useMemo(
    () => new Set(recommendedRestaurantIds.map((id) => String(id))),
    [recommendedRestaurantIds]
  );

  const filteredRestaurants = useMemo(() => {
    const list = Array.isArray(restaurants) ? [...restaurants] : [];
    const sortBy = String(filters.sortBy || "rating").toLowerCase();
    const toNum = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

    if (sortBy === "alphabetical") {
      return list.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
    }

    if (sortBy === "distance") {
      return list.sort((a, b) => {
        const ad = toNum(a?.distance_km, Number.MAX_SAFE_INTEGER);
        const bd = toNum(b?.distance_km, Number.MAX_SAFE_INTEGER);
        return ad !== bd ? ad - bd : toNum(b?.rating) - toNum(a?.rating);
      });
    }

    if (sortBy === "rating_asc") {
      return list.sort((a, b) => {
        const ar = toNum(a?.rating);
        const br = toNum(b?.rating);
        return ar !== br ? ar - br : String(a?.name || "").localeCompare(String(b?.name || ""));
      });
    }

    if (sortBy === "reviews") {
      return list.sort((a, b) => {
        const ar = toNum(a?.review_count);
        const br = toNum(b?.review_count);
        return ar !== br ? br - ar : toNum(b?.rating) - toNum(a?.rating);
      });
    }

    if (sortBy === "popularity") {
      return list.sort((a, b) => {
        const ap = toNum(a?.popularity_score);
        const bp = toNum(b?.popularity_score);
        return ap !== bp ? bp - ap : toNum(b?.rating) - toNum(a?.rating);
      });
    }

    return list.sort((a, b) => {
      const ar = toNum(a?.rating);
      const br = toNum(b?.rating);
      return ar !== br ? br - ar : String(a?.name || "").localeCompare(String(b?.name || ""));
    });
  }, [restaurants, filters.sortBy]);

  const optionCounts = useMemo(() => {
    const counts = {
      cuisine: Object.fromEntries(CUISINES.map((c) => [c, 0])),
      price: Object.fromEntries(PRICE_OPTIONS.map((p) => [p, 0])),
      dietary: Object.fromEntries(DIETARY_OPTIONS.map((d) => [d, 0])),
      topRated: 0,
      openNow: 0,
      availableToday: 0,
    };

    const today = getTodayDateValue();

    baseRestaurants.forEach((r) => {
      if (counts.cuisine[r.cuisine] != null) counts.cuisine[r.cuisine] += 1;
      if (counts.price[r.price_range] != null) counts.price[r.price_range] += 1;
      parseDietarySupport(r.dietary_support).forEach((d) => {
        if (counts.dietary[d] != null) counts.dietary[d] += 1;
      });
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
      const labels = {
        rating_asc: "Lowest Rated",
        distance: "Distance",
        reviews: "Reviews",
        popularity: "Popularity",
        alphabetical: "A-Z",
      };
      chips.push({
        key: "sort",
        label: `Sort: ${labels[filters.sortBy] || filters.sortBy}`,
        clear: () => updateFilters((p) => ({ ...p, sortBy: "rating" })),
      });
    }

    filters.priceRange.forEach((p) => chips.push({
      key: `price-${p}`,
      label: `Price: ${PRICE_LABELS[p] || p}`,
      clear: () => updateFilters((prev) => ({ ...prev, priceRange: prev.priceRange.filter((x) => x !== p) })),
    }));

    filters.dietarySupport.forEach((d) => chips.push({
      key: `dietary-${d}`,
      label: DIETARY_LABELS[d] || d,
      clear: () => updateFilters((prev) => ({ ...prev, dietarySupport: prev.dietarySupport.filter((x) => x !== d) })),
    }));

    filters.cuisines.forEach((c) => chips.push({
      key: `cuisine-${c}`,
      label: c,
      clear: () => updateFilters((prev) => ({ ...prev, cuisines: prev.cuisines.filter((x) => x !== c) })),
    }));

    return chips;
  }, [filters]);

  const sortOptions = [
    { value: "rating", label: "Top Rated" },
    { value: "rating_asc", label: "Lowest Rated" },
    { value: "distance", label: "Nearest" },
    { value: "reviews", label: "Most Reviewed" },
    { value: "popularity", label: "Most Popular" },
    { value: "alphabetical", label: "A-Z" },
  ];

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
      latitude: filters.distanceEnabled ? effectiveGeo.latitude : null,
      longitude: filters.distanceEnabled ? effectiveGeo.longitude : null,
      distanceRadius: filters.distanceEnabled ? filters.distanceRadius : null,
      sortBy: filters.sortBy,
    };

    searchRestaurants(query.trim(), filters.cuisines, payload)
      .then((filtered) => {
        if (cancelled) return;
        const nextRestaurants = Array.isArray(filtered) ? filtered : [];
        setRestaurants(nextRestaurants);
        setBaseRestaurants(nextRestaurants);
      })
      .catch(() => {
        if (cancelled) return;
        setRestaurants([]);
        setBaseRestaurants([]);
        setRestaurantsError("We couldn't load restaurants. Check your connection and try again.");
      })
      .finally(() => {
        if (!cancelled) setRestaurantsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, filters, effectiveGeo.latitude, effectiveGeo.longitude, refreshKey]);

  useEffect(() => {
    if (!user?.id) {
      setGeo({ latitude: null, longitude: null });
      return;
    }
    if (!filters.distanceEnabled) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({
        latitude: Number(pos.coords.latitude.toFixed(6)),
        longitude: Number(pos.coords.longitude.toFixed(6)),
      }),
      () => setGeo({ latitude: null, longitude: null }),
      { timeout: 7000 }
    );
  }, [user?.id, filters.distanceEnabled]);

  useEffect(() => {
    if (!user?.id) return;
    getFavorites()
      .then((data) => setFavorites(Array.isArray(data) ? data : []))
      .catch(() => setFavorites([]));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setRecommendedRestaurantIds([]);
      return;
    }

    let cancelled = false;
    getDiscoverRecommendations({
      latitude: effectiveGeo.latitude,
      longitude: effectiveGeo.longitude,
      limit: 12,
    })
      .then((payload) => {
        if (cancelled) return;
        const ids = Array.isArray(payload?.recommendations)
          ? payload.recommendations.map((item) => Number(item?.id)).filter(Number.isFinite)
          : [];
        setRecommendedRestaurantIds(ids);
      })
      .catch(() => {
        if (!cancelled) setRecommendedRestaurantIds([]);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, effectiveGeo.latitude, effectiveGeo.longitude]);

  useEffect(() => {
    const preset = String(initialCuisine || "").trim();
    if (!preset) return;
    setFilters((prev) => ({ ...prev, cuisines: [preset] }));
  }, [initialCuisineToken, initialCuisine]);

  useEffect(() => {
    if (!restaurantToOpen) return;
    setRestaurantNotFound(false);
    selectedRestaurantRequestRef.current += 1;
    setSelectedRestaurantDetailsLoading(false);
    setSelectedRestaurantDetailsError("");

    if (restaurantToOpen.name != null) {
      openRestaurantDetails(restaurantToOpen);
      clearRestaurantToOpen?.();
      return;
    }

    const id = restaurantToOpen.id ?? restaurantToOpen;
    if (id != null && pushRestaurantDetailHistory(id)) {
      clearRestaurantToOpen?.();
      return;
    }
    setSelectedRestaurantDetailsLoading(true);
    const requestId = selectedRestaurantRequestRef.current;
    getRestaurantById(id)
      .then((r) => {
        if (selectedRestaurantRequestRef.current !== requestId) return;
        setSelectedRestaurant(r);
        setSelectedRestaurantDetailsError("");
      })
      .catch(() => {
        if (selectedRestaurantRequestRef.current === requestId) setRestaurantNotFound(true);
      })
      .finally(() => {
        if (selectedRestaurantRequestRef.current === requestId) {
          setSelectedRestaurantDetailsLoading(false);
        }
        clearRestaurantToOpen?.();
      });
  }, [restaurantToOpen, clearRestaurantToOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!chatCommand?.type) return;

    let cancelled = false;

    async function applyChatCommand() {
      const { type, payload = {} } = chatCommand;

      if (type === "search_restaurants" || type === "apply_filters") {
        setRestaurantNotFound(false);
        replaceRestaurantDetailHistory();
        setSelectedRestaurant(null);
        setSelectedRestaurantDetailsLoading(false);
        setSelectedRestaurantDetailsError("");
        setQuery(typeof payload.query === "string" ? payload.query : "");
        setFilters({
          ...getInitialFilters(),
          ...(payload.filters && typeof payload.filters === "object" ? payload.filters : {}),
        });
        clearChatCommand?.();
        return;
      }

      if (type !== "view_restaurant" && type !== "book_table") {
        clearChatCommand?.();
        return;
      }

      setRestaurantNotFound(false);

      const openReservation = type === "book_table";
      const openResolvedRestaurant = (restaurant) => {
        if (cancelled) return;
        if (restaurant?.id) pushRestaurantDetailHistory(restaurant.id);
        selectedRestaurantRequestRef.current += 1;
        setSelectedRestaurant(restaurant);
        setSelectedRestaurantDetailsLoading(false);
        setSelectedRestaurantDetailsError("");
        if (openReservation) {
          setReservationIntentToken((prev) => prev + 1);
        }
      };

      const restaurantId = payload.restaurantId ?? payload.restaurant?.id ?? null;

      if (restaurantId == null) {
        if (payload.restaurant) {
          openResolvedRestaurant(payload.restaurant);
        }
        clearChatCommand?.();
        return;
      }

      try {
        const restaurant = await getRestaurantById(restaurantId);
        openResolvedRestaurant(restaurant);
      } catch {
        if (!cancelled) setRestaurantNotFound(true);
      } finally {
        if (!cancelled) clearChatCommand?.();
      }
    }

    applyChatCommand();

    return () => {
      cancelled = true;
    };
  }, [chatCommand, clearChatCommand]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollRestoreRef.current == null) return;
    const restoreTo = scrollRestoreRef.current;
    scrollRestoreRef.current = null;
    window.requestAnimationFrame(() => window.scrollTo({ top: restoreTo, behavior: "auto" }));
  }, [restaurants]);

  useEffect(() => {
    const initial = getInitialFilters();
    const active =
      query.trim().length > 0 ||
      filters.minRating !== initial.minRating ||
      filters.openNow !== initial.openNow ||
      filters.verifiedOnly !== initial.verifiedOnly ||
      filters.availabilityDate !== initial.availabilityDate ||
      filters.availabilityTime !== initial.availabilityTime ||
      filters.distanceEnabled !== initial.distanceEnabled ||
      Number(filters.distanceRadius) !== Number(initial.distanceRadius) ||
      filters.sortBy !== initial.sortBy ||
      filters.priceRange.length > 0 ||
      filters.dietarySupport.length > 0 ||
      filters.cuisines.length > 0;

    onSearchActiveChange?.(active);
  }, [query, filters, onSearchActiveChange]);

  useEffect(() => {
    const inDetails = !!selectedRestaurant;
    document.body.classList.toggle("ds-nav-not-sticky", inDetails);
    return () => document.body.classList.remove("ds-nav-not-sticky");
  }, [selectedRestaurant]);

  if (restaurantNotFound) {
    return (
      <div className="userSearchPage">
        <div className="formCard formCard--userProfile userSearchNotFoundCard">
          <button
            type="button"
            className="btn btn--ghost backArrowBtn backArrowBtn--topLeftInCard"
            onClick={() => setRestaurantNotFound(false)}
            aria-label="Go back"
          >
            ←
          </button>
          <p className="userSearchNotFoundCard__text">Restaurant not found or no longer available.</p>
        </div>
      </div>
    );
  }

  function handleRestaurantUpdated(updatedRestaurant) {
    if (!updatedRestaurant?.id) return;

    setRestaurants((prev) =>
      Array.isArray(prev)
        ? prev.map((restaurant) =>
            String(restaurant.id) === String(updatedRestaurant.id)
              ? { ...restaurant, ...updatedRestaurant }
              : restaurant
          )
        : prev
    );

    setBaseRestaurants((prev) =>
      Array.isArray(prev)
        ? prev.map((restaurant) =>
            String(restaurant.id) === String(updatedRestaurant.id)
              ? { ...restaurant, ...updatedRestaurant }
              : restaurant
          )
        : prev
    );

    setFavorites((prev) =>
      Array.isArray(prev)
        ? prev.map((restaurant) =>
            String(restaurant.id) === String(updatedRestaurant.id)
              ? { ...restaurant, ...updatedRestaurant }
              : restaurant
          )
        : prev
    );

    setSelectedRestaurant((prev) =>
      prev && String(prev.id) === String(updatedRestaurant.id)
        ? { ...prev, ...updatedRestaurant }
        : prev
    );
  }

  if (selectedRestaurant) {
    return (
      <RestaurantDetailPanel
        restaurant={selectedRestaurant}
        detailsLoading={selectedRestaurantDetailsLoading}
        menuLoading={selectedRestaurantDetailsLoading}
        menuLoadError={selectedRestaurantDetailsError}
        userLocation={effectiveGeo}
        isFavorited={isFavorited}
        onToggleFavorite={toggleFavorite}
        requireAuth={requireAuth}
        reservationIntentToken={reservationIntentToken}
        onRestaurantUpdated={handleRestaurantUpdated}
        onBack={handleRestaurantDetailBack}
      />
    );
  }

  return (
    <div className="userSearchPage">
      <h1 className="userSearchPage__title userSearchPage__title--script">Search Restaurants</h1>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "12px",
          width: "100%",
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        <input
          ref={searchBarRef}
          className="searchInput"
          type="text"
          style={{ flex: "1 1 320px", width: "100%", maxWidth: "700px" }}
          placeholder="Search by name, cuisine, or keyword"
          value={query}
          onChange={(e) => {
            scrollRestoreRef.current = window.scrollY;
            if (e.target.value === "") {
              // Save whatever was typed before clearing
              saveRecentSearch(lastQueryRef.current);
              lastQueryRef.current = "";
              setShowRecent(true);
            } else {
              setShowRecent(false);
            }
            setQuery(e.target.value);
          }}
          onFocus={() => {
            if (!query && searchBarRef.current) {
              const rect = searchBarRef.current.getBoundingClientRect();
              setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: Math.min(rect.width, 400) });
              setShowRecent(true);
            }
          }}
          aria-label="Search restaurants"
        />

        {showRecent && recentSearches.length > 0 && createPortal(
          <div ref={dropdownRef} className="recentSearchesDropdown" style={{ position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }} onMouseDown={e => e.stopPropagation()}>
            <div className="recentSearchesDropdown__header">
              <span>Recent Searches</span>
              <button
                type="button"
                className="recentSearchesDropdown__clear"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleClearRecent(); }}
              >
                Clear all
              </button>
            </div>
            {recentSearches.map((item) => (
              <div
                key={item.id ?? item.query}
                className="recentSearchesDropdown__item"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleSelectRecent(item.query); }}
              >
                <span className="recentSearchesDropdown__icon">🕐</span>
                <span className="recentSearchesDropdown__text">{item.query}</span>
                <button
                  type="button"
                  className="recentSearchesDropdown__remove"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveRecent(e, item); }}
                  aria-label={`Remove ${item.query}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}

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
          <ThemedSelect
            value={filters.sortBy}
            onChange={(nextValue) => {
              updateFilters((prev) => ({ ...prev, sortBy: nextValue }));
            }}
            options={sortOptions}
            placeholder="Top Rated"
            ariaLabel="Sort restaurants"
            fullWidth={false}
          />
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

        {!restaurantsLoading && filteredRestaurants.map((r) => (
          <div
            key={r.id}
          >
            <RestaurantCard
              r={r}
              isFavorited={isFavorited(r.id)}
              isRecommended={recommendedRestaurantSet.has(String(r.id))}
              showDistance={showRestaurantDistance}
              onSelect={(restaurant) => {
                saveRecentSearch(lastQueryRef.current);
                lastQueryRef.current = "";
                openRestaurantDetails(restaurant);
              }}
              onFavorite={(restaurant) => {
                if (!requireAuth()) return;
                toggleFavorite(restaurant);
              }}
              onReserve={(restaurant) => {
                if (!requireAuth()) return;
                openRestaurantDetails(restaurant, { reserve: true });
              }}
            />
          </div>
        ))}
      </div>

      <SearchFilterDrawer
        isOpen={drawerOpen}
        initialFilters={filters}
        effectiveGeo={effectiveGeo}
        optionCounts={optionCounts}
        onClose={() => setDrawerOpen(false)}
        onApply={(newFilters) => {
          updateFilters(newFilters);
          setDrawerOpen(false);
        }}
        onReset={() => getInitialFilters()}
      />
    </div>
  );
}
