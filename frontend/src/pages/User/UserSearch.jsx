import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft, FiClock, FiMapPin, FiStar } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getReviewsByRestaurantId, createReview } from "../../services/reviewService";
import { searchRestaurants, getRestaurantById } from "../../services/restaurantService";
import { getReservationAvailability } from "../../services/reservationService";
import ReservationForm from "../../components/ReservationForm.jsx";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";

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

const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Halal", "GF"];
const PRICE_OPTIONS = ["$", "$$", "$$$", "$$$$"];
const PRICE_LABELS = {
  $: "Budget",
  $$: "Moderate",
  $$$: "Premium",
  $$$$: "Luxury",
};
const DIETARY_LABELS = {
  Vegetarian: "Vegetarian",
  Vegan: "Vegan",
  Halal: "Halal",
  GF: "Gluten-Free",
};

const FAVORITES_KEY = "ds_favorites";
const FILLED_STAR = "\u2605";
const EMPTY_STAR = "\u2606";

function pad2(value) {
  return String(value).padStart(2, "0");
}

function getTodayDateValue() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function getCurrentSlotParams() {
  const now = new Date();
  const roundedMinutes = Math.ceil(now.getMinutes() / 15) * 15;
  if (roundedMinutes >= 60) {
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
  } else {
    now.setMinutes(roundedMinutes);
  }
  now.setSeconds(0, 0);

  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  return { date, time };
}

function toMinutesOfDay(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return (hours * 60) + minutes;
}

function isOpenNow(openingTime, closingTime) {
  const open = toMinutesOfDay(openingTime);
  const close = toMinutesOfDay(closingTime);
  if (open == null || close == null) return false;

  const now = new Date();
  const current = (now.getHours() * 60) + now.getMinutes();

  if (close >= open) {
    return current >= open && current <= close;
  }

  // Overnight schedule (example: 20:00 -> 02:00)
  return current >= open || current <= close;
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
  };
}

function parseDietarySupport(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  const normalized = value.trim();
  if (!normalized) return [];
  if (normalized.startsWith("{") && normalized.endsWith("}")) {
    return normalized
      .slice(1, -1)
      .split(",")
      .map((item) => item.replace(/^"|"$/g, "").trim())
      .filter(Boolean);
  }
  return normalized
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatTimeLabel(timeValue) {
  const [rawHour = "0", rawMinute = "00"] = String(timeValue || "").split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return String(timeValue || "");
  const hour12 = ((hour + 11) % 12) + 1;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

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
  const [query, setQuery] = useState("");

  const [restaurants, setRestaurants] = useState([]);
  const [baseRestaurants, setBaseRestaurants] = useState([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);

  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [restaurantNotFound, setRestaurantNotFound] = useState(false);
  const [detailsTab, setDetailsTab] = useState("menu"); // "menu" | "reviews"

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewPosting, setReviewPosting] = useState(false);
  const [reservationInlineOpen, setReservationInlineOpen] = useState(false);
  const [reservationToast, setReservationToast] = useState("");
  const [reservationAvailability, setReservationAvailability] = useState(null);
  const [reservationSlot, setReservationSlot] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFilters, setDrawerFilters] = useState(getInitialFilters());
  const [filters, setFilters] = useState(getInitialFilters());
  const [geo, setGeo] = useState({ latitude: null, longitude: null });

  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [activeSectionId, setActiveSectionId] = useState(null);

  const sectionRefs = useRef({});
  const sliderTrackRef = useRef(null);
  const drawerRef = useRef(null);
  const scrollRestoreRef = useRef(null);
  const reservationInlineRef = useRef(null);
  const menuSectionRef = useRef(null);
  const reviewsSectionRef = useRef(null);

  function requireAuth() {
    if (isGuest || !user?.id) {
      onRequireSignup?.();
      return false;
    }
    return true;
  }

  function openInlineReservation() {
    setReservationInlineOpen(true);
    window.requestAnimationFrame(() => {
      reservationInlineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveFavorites(list) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  }

  function isFavorited(restaurantId) {
    return favorites.some((r) => r.id === restaurantId);
  }

  function toggleFavorite(restaurant) {
    setFavorites((prev) => {
      const exists = prev.some((r) => r.id === restaurant.id);
      const next = exists ? prev.filter((x) => x.id !== restaurant.id) : [...prev, restaurant];
      saveFavorites(next);
      return next;
    });
  }

  function updateFilters(updater, preserveScroll = true) {
    if (preserveScroll) {
      scrollRestoreRef.current = window.scrollY;
    }
    setFilters((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }

  function resetFilters() {
    updateFilters(getInitialFilters());
  }

  function toggleDrawerArrayFilter(key, value) {
    setDrawerFilters((prev) => {
      const current = prev[key] || [];
      return {
        ...prev,
        [key]: current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value],
      };
    });
  }

  function toggleQuickTopRated() {
    updateFilters((prev) => ({ ...prev, minRating: prev.minRating >= 4 ? 0 : 4 }));
  }

  function toggleQuickOpenNow() {
    updateFilters((prev) => ({ ...prev, openNow: !prev.openNow }));
  }

  function toggleQuickAvailableToday() {
    const { date, time } = getCurrentSlotParams();
    updateFilters((prev) => {
      const enabled = prev.availabilityDate === date;
      return {
        ...prev,
        availabilityDate: enabled ? "" : date,
        availabilityTime: enabled ? "" : (prev.availabilityTime || time),
      };
    });
  }

  function toggleQuickPrice() {
    updateFilters((prev) => {
      const enabled = prev.priceRange.length === 1 && prev.priceRange[0] === "$$";
      return { ...prev, priceRange: enabled ? [] : ["$$"] };
    });
  }

  function toggleQuickDietary() {
    updateFilters((prev) => {
      const has = prev.dietarySupport.includes("Vegetarian");
      return {
        ...prev,
        dietarySupport: has
          ? prev.dietarySupport.filter((item) => item !== "Vegetarian")
          : [...prev.dietarySupport, "Vegetarian"],
      };
    });
  }

  function toggleQuickDistance() {
    updateFilters((prev) => ({
      ...prev,
      distanceEnabled: !prev.distanceEnabled,
      distanceRadius: prev.distanceRadius || 10,
    }));
  }

  function openDrawer() {
    setDrawerFilters(filters);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  function applyDrawerFilters() {
    updateFilters({ ...drawerFilters });
    setDrawerOpen(false);
  }

  const profileGeo = useMemo(() => {
    const latitude = Number(user?.latitude);
    const longitude = Number(user?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { latitude: null, longitude: null };
    }
    return { latitude, longitude };
  }, [user?.latitude, user?.longitude]);

  const effectiveGeo = useMemo(() => {
    if (geo.latitude != null && geo.longitude != null) {
      return { latitude: geo.latitude, longitude: geo.longitude };
    }
    return profileGeo;
  }, [geo.latitude, geo.longitude, profileGeo]);

  // Fetch restaurants from search API with advanced filters and a base set for option counts.
  useEffect(() => {
    let cancelled = false;
    setRestaurantsLoading(true);

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
    };

    Promise.all([
      searchRestaurants(query.trim(), filters.cuisines, payload),
      searchRestaurants(query.trim(), [], {
        verifiedOnly: true,
        latitude: effectiveGeo.latitude,
        longitude: effectiveGeo.longitude,
      }),
    ])
      .then(([filtered, base]) => {
        if (cancelled) return;
        setRestaurants(Array.isArray(filtered) ? filtered : []);
        setBaseRestaurants(Array.isArray(base) ? base : []);
      })
      .catch(() => {
        if (cancelled) return;
        setRestaurants([]);
        setBaseRestaurants([]);
      })
      .finally(() => {
        if (!cancelled) setRestaurantsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, filters, effectiveGeo.latitude, effectiveGeo.longitude]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        });
      },
      () => {
        setGeo({ latitude: null, longitude: null });
      },
      { timeout: 7000 }
    );
  }, []);

  useEffect(() => {
    const preset = String(initialCuisine || "").trim();
    if (!preset) return;
    setFilters((prev) => ({
      ...prev,
      cuisines: [preset],
    }));
  }, [initialCuisineToken, initialCuisine]);

  // If coming from Favorites -> open restaurant (validate by ID if needed)
  useEffect(() => {
    if (!restaurantToOpen) return;
    setRestaurantNotFound(false);
    if (restaurantToOpen.name != null) {
      setSelectedRestaurant(restaurantToOpen);
      setDetailsTab("menu");
      setReservationInlineOpen(false);
      clearRestaurantToOpen?.();
      return;
    }
    const id = restaurantToOpen.id ?? restaurantToOpen;
    getRestaurantById(id)
      .then((r) => {
        setSelectedRestaurant(r);
        setDetailsTab("menu");
        setReservationInlineOpen(false);
      })
      .catch(() => setRestaurantNotFound(true))
      .finally(() => clearRestaurantToOpen?.());
  }, [restaurantToOpen, clearRestaurantToOpen]);

  // Fetch reviews when restaurant details are opened
  useEffect(() => {
    if (!selectedRestaurant) return;
    setReviewsLoading(true);
    setReviews([]);
    getReviewsByRestaurantId(selectedRestaurant.id)
      .then((data) => setReviews(Array.isArray(data) ? data : []))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  }, [selectedRestaurant]);

  useEffect(() => {
    if (!reservationToast) return undefined;
    const timeoutId = window.setTimeout(() => setReservationToast(""), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [reservationToast]);

  useEffect(() => {
    if (!selectedRestaurant?.id) {
      setReservationAvailability(null);
      setReservationSlot(null);
      return;
    }

    const { date, time } = reservationSlot || getCurrentSlotParams();
    getReservationAvailability({
      restaurantId: selectedRestaurant.id,
      date,
      time,
    })
      .then((availability) => setReservationAvailability(availability))
      .catch(() => setReservationAvailability(null));
  }, [selectedRestaurant?.id, reservationSlot]);

  useEffect(() => {
    function handleReservationChanged(event) {
      if (!selectedRestaurant?.id) return;
      const detail = event?.detail || {};
      if (detail.restaurantId != null && Number(detail.restaurantId) !== Number(selectedRestaurant.id)) return;

      const date = detail.date ? String(detail.date).slice(0, 10) : (reservationSlot?.date || getCurrentSlotParams().date);
      const time = detail.time ? String(detail.time).slice(0, 5) : (reservationSlot?.time || getCurrentSlotParams().time);
      setReservationSlot({ date, time });

      getReservationAvailability({
        restaurantId: selectedRestaurant.id,
        date,
        time,
      })
        .then((availability) => setReservationAvailability(availability))
        .catch(() => setReservationAvailability(null));

      getRestaurantById(selectedRestaurant.id)
        .then((updatedRestaurant) => setSelectedRestaurant(updatedRestaurant))
        .catch(() => {});
    }

    window.addEventListener("ds:reservation-changed", handleReservationChanged);
    return () => window.removeEventListener("ds:reservation-changed", handleReservationChanged);
  }, [selectedRestaurant?.id, reservationSlot?.date, reservationSlot?.time]);

  useEffect(() => {
    if (scrollRestoreRef.current == null) return;
    const restoreTo = scrollRestoreRef.current;
    scrollRestoreRef.current = null;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: restoreTo, behavior: "auto" });
    });
  }, [restaurants]);

  const filteredRestaurants = restaurants;

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
      || filters.priceRange.length > 0
      || filters.dietarySupport.length > 0
      || filters.cuisines.length > 0;

    onSearchActiveChange?.(active);
  }, [query, filters, onSearchActiveChange]);

  // Disable sticky navbar only while inside restaurant details (menu/reviews)
  useEffect(() => {
    const inDetails = !!selectedRestaurant;
    document.body.classList.toggle("ds-nav-not-sticky", inDetails);
    return () => document.body.classList.remove("ds-nav-not-sticky");
  }, [selectedRestaurant]);

  useEffect(() => {
    if (!drawerOpen) return;
    const panel = drawerRef.current;
    if (!panel) return;

    const previousActive = document.activeElement;
    const focusableSelector = [
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const focusable = Array.from(panel.querySelectorAll(focusableSelector));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab" || focusable.length === 0) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousActive && typeof previousActive.focus === "function") {
        previousActive.focus();
      }
    };
  }, [drawerOpen]);

  // Active section tracking
  useEffect(() => {
    if (!selectedRestaurant) return;

    const sections = selectedRestaurant.menu_sections ?? selectedRestaurant.menu ?? [];
    if (!sections.length) return;

    setActiveSectionId((prev) => prev || sections[0].sectionId);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0))[0];

        if (visible) {
          const id = visible.target.getAttribute("data-section-id");
          if (id) setActiveSectionId(id);
        }
      },
      { threshold: 0.35 }
    );

    sections.forEach((sec) => {
      const el = sectionRefs.current[sec.sectionId];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [selectedRestaurant]);

  function scrollToSection(sectionId) {
    const el = sectionRefs.current[sectionId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function slideSections(dir) {
    const el = sliderTrackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.6, behavior: "smooth" });
  }

  // Normalize menu from API (backend returns menu_sections; support legacy .menu)
  const restaurantMenu = useMemo(() => {
    if (!selectedRestaurant) return [];
    const raw = selectedRestaurant.menu_sections ?? selectedRestaurant.menu;
    return Array.isArray(raw) ? raw : [];
  }, [selectedRestaurant]);

  const availabilityBadge = useMemo(() => {
    if (!reservationAvailability) return null;

    const availableSeats = Number(reservationAvailability.available_seats || 0);
    const totalCapacity = Number(reservationAvailability.total_capacity || 0);
    const slotTime = String(
      reservationSlot?.time
      || reservationAvailability.reservation_time
      || getCurrentSlotParams().time
    ).slice(0, 5);
    const slotLabel = formatTimeLabel(slotTime);
    if (totalCapacity <= 0) {
      return { label: `Availability unavailable for ${slotLabel}`, tone: "warn" };
    }

    const ratio = availableSeats / totalCapacity;
    if (ratio >= 0.6) return { label: `${availableSeats} seats available at ${slotLabel}`, tone: "good" };
    if (ratio >= 0.25) return { label: `${availableSeats} seats available at ${slotLabel}`, tone: "warn" };
    return { label: `${availableSeats} seats available at ${slotLabel}`, tone: "danger" };
  }, [reservationAvailability, reservationSlot?.time]);

  const restaurantHoursLabel = useMemo(() => {
    if (!selectedRestaurant) return "Hours unavailable";
    const opening = selectedRestaurant.opening_time ?? selectedRestaurant.openingTime;
    const closing = selectedRestaurant.closing_time ?? selectedRestaurant.closingTime;
    if (!opening || !closing) return "Hours unavailable";
    return `${String(opening).slice(0, 5)} - ${String(closing).slice(0, 5)}`;
  }, [selectedRestaurant]);

  const ratingValue = useMemo(() => {
    const value = Number(selectedRestaurant?.rating ?? 0);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(5, Math.round(value)));
  }, [selectedRestaurant?.rating]);

  const optionCounts = useMemo(() => {
    const counts = {
      cuisine: Object.fromEntries(CUISINES.map((item) => [item, 0])),
      price: Object.fromEntries(PRICE_OPTIONS.map((item) => [item, 0])),
      dietary: Object.fromEntries(DIETARY_OPTIONS.map((item) => [item, 0])),
      topRated: 0,
      openNow: 0,
      availableToday: 0,
    };

    const today = getTodayDateValue();
    baseRestaurants.forEach((restaurant) => {
      if (counts.cuisine[restaurant.cuisine] != null) counts.cuisine[restaurant.cuisine] += 1;
      if (counts.price[restaurant.price_range] != null) counts.price[restaurant.price_range] += 1;

      parseDietarySupport(restaurant.dietary_support).forEach((item) => {
        if (counts.dietary[item] != null) counts.dietary[item] += 1;
      });

      if (Number(restaurant.rating || 0) >= 4) counts.topRated += 1;
      if (isOpenNow(restaurant.opening_time ?? restaurant.openingTime, restaurant.closing_time ?? restaurant.closingTime)) counts.openNow += 1;
      if (today) counts.availableToday += 1;
    });

    return counts;
  }, [baseRestaurants]);

  const activeFilterChips = useMemo(() => {
    const chips = [];

    if (filters.minRating > 0) chips.push({ key: "min", label: `Rating >= ${filters.minRating}`, clear: () => updateFilters((prev) => ({ ...prev, minRating: 0 })) });
    if (filters.openNow) chips.push({ key: "open", label: "Open Now", clear: () => updateFilters((prev) => ({ ...prev, openNow: false })) });
    if (filters.availabilityDate) chips.push({ key: "date", label: `Date: ${filters.availabilityDate}`, clear: () => updateFilters((prev) => ({ ...prev, availabilityDate: "", availabilityTime: "" })) });
    if (filters.availabilityTime) chips.push({ key: "time", label: `Time: ${filters.availabilityTime}`, clear: () => updateFilters((prev) => ({ ...prev, availabilityTime: "" })) });
    if (filters.distanceEnabled) chips.push({ key: "distance", label: `Distance: ${filters.distanceRadius}km`, clear: () => updateFilters((prev) => ({ ...prev, distanceEnabled: false })) });
    filters.priceRange.forEach((price) => chips.push({ key: `price-${price}`, label: `Price: ${PRICE_LABELS[price] || price}`, clear: () => updateFilters((prev) => ({ ...prev, priceRange: prev.priceRange.filter((item) => item !== price) })) }));
    filters.dietarySupport.forEach((dietary) => chips.push({ key: `dietary-${dietary}`, label: DIETARY_LABELS[dietary] || dietary, clear: () => updateFilters((prev) => ({ ...prev, dietarySupport: prev.dietarySupport.filter((item) => item !== dietary) })) }));
    filters.cuisines.forEach((cuisine) => chips.push({ key: `cuisine-${cuisine}`, label: cuisine, clear: () => updateFilters((prev) => ({ ...prev, cuisines: prev.cuisines.filter((item) => item !== cuisine) })) }));

    return chips;
  }, [filters]);

  // =========================
  // Invalid restaurant ID
  // =========================
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

  // =========================
  // Details view (restaurant)
  // =========================
  if (selectedRestaurant) {
    return (
      <div className="userSearchPage">
        {reservationToast && (
          <div className="inlineToast">
            {reservationToast}
          </div>
        )}

        <header className="restaurantPageHeader">
          <button
            className="btn btn--ghost restaurantPageHeader__backBtn"
            type="button"
            onClick={() => {
              setSelectedRestaurant(null);
              setRestaurantNotFound(false);
              setReservationInlineOpen(false);
            }}
            aria-label="Back to Search"
          >
            <FiArrowLeft />
            <span>Back to Search</span>
          </button>
          <h2 className="restaurantPageHeader__title">Restaurant Page</h2>
        </header>

        <section className="restaurantProfileHero restaurantProfileHero--splitLayout">
          <div className="restaurantProfileHero__titleRow">
            <div className="restaurantProfileHero__logo">
              {(selectedRestaurant.logoUrl || selectedRestaurant.logo_url || selectedRestaurant.coverUrl || selectedRestaurant.cover_url) ? (
                <img
                  className="restaurantProfileHero__logoImg"
                  src={selectedRestaurant.logoUrl || selectedRestaurant.logo_url || selectedRestaurant.coverUrl || selectedRestaurant.cover_url}
                  alt={`${selectedRestaurant.name} logo`}
                />
              ) : (
                <span className="restaurantProfileHero__logoFallback">
                  {(selectedRestaurant.name || "R")[0]?.toUpperCase?.() || "R"}
                </span>
              )}
            </div>
            <h1 className="restaurantProfileHero__name">{selectedRestaurant.name}</h1>
          </div>

          <div className="restaurantHeroInfoCard">
            <div className="restaurantHeroInfoItem">
              <span className="restaurantHeroInfoIcon">🍽</span>
              <span>{selectedRestaurant.cuisine || "Cuisine"}</span>
            </div>
            <div className="restaurantHeroInfoItem">
              <FiStar className="restaurantHeroInfoIcon" />
              <span>
                {selectedRestaurant.rating ?? "N/A"} ({FILLED_STAR.repeat(ratingValue)}{EMPTY_STAR.repeat(Math.max(0, 5 - ratingValue))})
              </span>
            </div>
            <div className="restaurantHeroInfoItem">
              <FiMapPin className="restaurantHeroInfoIcon" />
              <span>{selectedRestaurant.distance_km != null ? `${selectedRestaurant.distance_km} km` : "Distance unavailable"}</span>
            </div>
            <div className="restaurantHeroInfoItem">
              <span className="restaurantHeroInfoIcon">🪑</span>
              <span>{availabilityBadge ? availabilityBadge.label : "Seats unavailable"}</span>
            </div>
            <div className="restaurantHeroInfoItem">
              <FiClock className="restaurantHeroInfoIcon" />
              <span>{restaurantHoursLabel}</span>
            </div>
          </div>

          <div className="restaurantProfileHero__media">
            {(selectedRestaurant.coverUrl || selectedRestaurant.cover_url || selectedRestaurant.logoUrl || selectedRestaurant.logo_url) ? (
              <img
                className="restaurantProfileHero__img"
                src={selectedRestaurant.coverUrl || selectedRestaurant.cover_url || selectedRestaurant.logoUrl || selectedRestaurant.logo_url}
                alt={`${selectedRestaurant.name} cover`}
              />
            ) : (
              <div className="restaurantProfileHero__placeholder">DineSmart • {selectedRestaurant.name}</div>
            )}
          </div>

          <div className="restaurantActionBar">
            <div className="restaurantActionTabs">
            <button
              className={`restaurantActionTab ${detailsTab === "menu" ? "is-active" : ""}`}
              type="button"
              onClick={() => {
                setDetailsTab("menu");
                setReservationInlineOpen(false);
                menuSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Menu
            </button>
            <button
              className={`restaurantActionTab ${detailsTab === "reviews" ? "is-active" : ""}`}
              type="button"
              onClick={() => {
                setDetailsTab("reviews");
                setReservationInlineOpen(false);
                reviewsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Reviews
            </button>
            <button
              className={`restaurantActionTab ${reservationInlineOpen ? "is-active" : ""}`}
              type="button"
              onClick={() => {
                if (!requireAuth()) return;
                setDetailsTab("menu");
                openInlineReservation();
              }}
            >
              Reserve
            </button>
            </div>
            <button
              className={`favoriteHeartBtn restaurantActionFavorite ${isFavorited(selectedRestaurant.id) ? "is-active" : ""}`}
              type="button"
              onClick={() => {
                if (!requireAuth()) return;
                toggleFavorite(selectedRestaurant);
              }}
              aria-label={isFavorited(selectedRestaurant.id) ? "Remove from favorites" : "Add to favorites"}
            >
              <svg viewBox="0 0 24 24" className="favoriteHeartIcon" aria-hidden="true">
                <path d="M12 21s-7.2-4.6-9.6-9C.7 8.7 2.1 5.5 5.4 4.6c1.8-.5 3.6.1 4.8 1.4L12 7.8l1.8-1.8c1.2-1.3 3-1.9 4.8-1.4 3.3.9 4.7 4.1 3 7.4C19.2 16.4 12 21 12 21z" />
              </svg>
            </button>
          </div>
        </section>

        {reservationInlineOpen && (
          <section className="restaurantInlineReserve" ref={reservationInlineRef}>
            <h2 className="restaurantInlineReserve__title">Reserve a Table</h2>
            <ReservationForm
              isOpen={true}
              inline
              restaurant={selectedRestaurant}
              onClose={() => {}}
              onReserved={(reservation) => {
                setReservationToast("Reservation confirmed! Check your email.");
                const date = reservation?.reservation_date || reservationSlot?.date || getCurrentSlotParams().date;
                const time = String(reservation?.reservation_time || reservationSlot?.time || getCurrentSlotParams().time).slice(0, 5);
                setReservationSlot({ date, time });
                getReservationAvailability({
                  restaurantId: selectedRestaurant.id,
                  date,
                  time,
                })
                  .then((availability) => setReservationAvailability(availability))
                  .catch(() => setReservationAvailability(null));
                window.dispatchEvent(
                  new CustomEvent("ds:reservation-changed", {
                    detail: {
                      reservationId: reservation?.id ?? null,
                      restaurantId: selectedRestaurant.id,
                      date,
                      time,
                      action: "created",
                    },
                  })
                );
              }}
            />
          </section>
        )}

        {detailsTab === "menu" ? (
          <div className="userMenuView" ref={menuSectionRef}>
            <h2 className="userMenuView__title">Menu</h2>

            {restaurantMenu.length ? (
              <div className="menuSectionSlider">
                <button className="menuSectionSlider__arrow" type="button" onClick={() => slideSections(-1)} aria-label="Scroll sections left">
                  &#8249;
                </button>

                <div className="menuSectionSlider__pill" aria-label="Menu sections">
                  <div className="menuSectionSlider__track" ref={sliderTrackRef}>
                    {restaurantMenu.map((sec) => (
                      <button
                        key={sec.sectionId}
                        type="button"
                        className={`menuSectionSlider__btn ${activeSectionId === sec.sectionId ? "is-active" : ""}`}
                        onClick={() => scrollToSection(sec.sectionId)}
                      >
                        {sec.sectionName}
                      </button>
                    ))}
                  </div>
                </div>

                <button className="menuSectionSlider__arrow" type="button" onClick={() => slideSections(1)} aria-label="Scroll sections right">
                  &#8250;
                </button>
              </div>
            ) : null}

            {restaurantMenu.length ? (
              <div className="userMenuSections">
                {restaurantMenu.map((sec) => (
                  <div
                    className="menuSectionBlock userMenuSectionBlock"
                    key={sec.sectionId}
                    data-section-id={sec.sectionId}
                    ref={(el) => {
                      if (el) sectionRefs.current[sec.sectionId] = el;
                    }}
                  >
                    <div className="menuSectionHeader">
                      <button className="btn btn--gold ownerMenuSectionBtn" type="button">
                        {sec.sectionName}
                      </button>
                    </div>

                    <div className="ownerMenuItemsGrid">
                      {sec.items.map((it) => (
                        <div className="menuItemCard" key={it.id}>
                          <div className="menuItemCard__media">
                            {(it.imageUrl || it.image_url) ? (
                              <img className="menuItemCard__img" src={it.imageUrl || it.image_url} alt={it.name} />
                            ) : (
                              <div className="menuItemCard__imgPlaceholder">PNG, JPG, or JPEG</div>
                            )}
                          </div>

                          <div className="menuItemCard__info">
                            <div className="menuItemCard__name">{it.name}</div>
                            <div className="menuItemCard__price">
                              {it.price} {it.currency}
                            </div>
                            {it.description && <div className="menuItemCard__desc">{it.description}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="menuSectionEmpty">No menu uploaded yet.</div>
            )}
          </div>
        ) : (
          <div className="restaurantReviewsPage" ref={reviewsSectionRef}>
            <div className="reviewCard">
              <div className="reviewCard__title">Add a review</div>

              <div className="reviewComposer">
                <div className="reviewComposer__top">
                <select
                  className="select reviewCard__select"
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  disabled={reviewPosting}
                >
                  <option value="5">5 {FILLED_STAR}</option>
                  <option value="4">4 {FILLED_STAR}</option>
                  <option value="3">3 {FILLED_STAR}</option>
                  <option value="2">2 {FILLED_STAR}</option>
                  <option value="1">1 {FILLED_STAR}</option>
                </select>
                <button
                  className="btn btn--gold reviewComposer__post"
                  type="button"
                  disabled={reviewPosting}
                  onClick={async () => {
                    if (!requireAuth()) return;
                    if (!reviewComment.trim()) {
                      setReviewError("Please write a comment.");
                      return;
                    }
                    if (reviewComment.trim().length > 500) {
                      setReviewError("Review must be at most 500 characters.");
                      return;
                    }
                    setReviewError("");
                    setReviewPosting(true);
                    try {
                      await createReview(selectedRestaurant.id, {
                        rating: reviewRating,
                        comment: reviewComment.trim(),
                      });
                      setReviewComment("");
                      setReviewRating(5);
                      const [reviewsData, updatedRestaurant] = await Promise.all([
                        getReviewsByRestaurantId(selectedRestaurant.id),
                        getRestaurantById(selectedRestaurant.id),
                      ]);
                      setReviews(Array.isArray(reviewsData) ? reviewsData : []);
                      setSelectedRestaurant(updatedRestaurant);
                      window.dispatchEvent(
                        new CustomEvent("ds:review-changed", {
                          detail: {
                            restaurantId: selectedRestaurant.id,
                            action: "created",
                          },
                        })
                      );
                    } catch (err) {
                      setReviewError(err.message || "Failed to post review.");
                    } finally {
                      setReviewPosting(false);
                    }
                  }}
                >
                  {reviewPosting ? "Posting..." : "Post"}
                </button>
                </div>

                <textarea
                  className="reviewCard__input reviewCard__input--textarea"
                  placeholder="Write your review (max 500 characters)"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  maxLength={500}
                  rows={4}
                  disabled={reviewPosting}
                />
                <span className="reviewCard__charCount">{reviewComment.length}/500</span>
              </div>

              {reviewError && (
                <div className="fieldError reviewCard__status">{reviewError}</div>
              )}
            </div>

            <div className="reviewsDivider">
              <span className="reviewsDivider__text">What Diners Say</span>
            </div>

            {reviewsLoading ? (
              <div className="menuSectionEmpty">Loading reviews...</div>
            ) : reviews.length ? (
              <div className="reviewsStack">
                {reviews.map((rev) => (
                  <div className="reviewCardFull" key={rev.id}>
                    <div className="reviewCardFull__left">
                      <div className="reviewCardFull__avatar">
                        {(rev.profilePictureUrl || rev.profile_picture_url) ? (
                          <img
                            className="reviewCardFull__avatarImg"
                            src={rev.profilePictureUrl || rev.profile_picture_url}
                            alt={`${rev.user_name || rev.authorName || "User"} avatar`}
                          />
                        ) : (
                          <span className="reviewCardFull__avatarFallback">
                            {(rev.user_name || rev.authorName || "?")[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="reviewCardFull__right">
                      <div className="reviewCardFull__top">
                        <div className="reviewCardFull__userName">{rev.user_name || rev.authorName || "Anonymous"}</div>
                        <div className="reviewCardFull__date">
                          {(rev.created_at || rev.createdAt) ? new Date(rev.created_at || rev.createdAt).toLocaleDateString() : ""}
                        </div>
                      </div>

                      <div className="reviewCardFull__stars">
                        {FILLED_STAR.repeat(Math.max(0, Number(rev.rating) || 0))}
                        {EMPTY_STAR.repeat(Math.max(0, 5 - (Number(rev.rating) || 0)))}
                      </div>

                      <div className="reviewCardFull__text">{rev.comment}</div>

                      {rev.owner_response && (
                        <div className="ownerResponseBlock">
                          <div className="ownerResponseBlock__label">Restaurant response</div>
                          <div className="ownerResponseBlock__text">{rev.owner_response}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="menuSectionEmpty">No reviews yet. Be the first!</div>
            )}
          </div>
        )}

      </div>
    );
  }

  // =========================
  // Search/list view
  // =========================
  return (
    <div className="userSearchPage">
      <h1 className="userSearchPage__title">Search Restaurants</h1>

      <div className="searchBarCard">
        <input
          className="searchInput"
          type="text"
          placeholder="Search by name, cuisine, or keyword"
          value={query}
          onChange={(e) => {
            scrollRestoreRef.current = window.scrollY;
            setQuery(e.target.value);
          }}
          aria-label="Search restaurants"
        />
      </div>

      <div className="quickFiltersBar" role="toolbar" aria-label="Quick filters">
        <button
          type="button"
          className={`quickFilterBtn ${filters.minRating >= 4 ? "is-active" : ""}`}
          onClick={toggleQuickTopRated}
          disabled={optionCounts.topRated === 0}
          aria-pressed={filters.minRating >= 4}
          aria-label="Toggle top rated"
        >
          Top Rated ({optionCounts.topRated})
        </button>
        <button
          type="button"
          className={`quickFilterBtn ${filters.openNow ? "is-active" : ""}`}
          onClick={toggleQuickOpenNow}
          disabled={optionCounts.openNow === 0}
          aria-pressed={filters.openNow}
          aria-label="Toggle open now"
        >
          Open Now ({optionCounts.openNow})
        </button>
        <button
          type="button"
          className={`quickFilterBtn ${filters.availabilityDate === getTodayDateValue() ? "is-active" : ""}`}
          onClick={toggleQuickAvailableToday}
          aria-pressed={filters.availabilityDate === getTodayDateValue()}
          aria-label="Toggle available today"
        >
          Available Today ({optionCounts.availableToday})
        </button>
        <button
          type="button"
          className={`quickFilterBtn ${(filters.priceRange.length === 1 && filters.priceRange[0] === "$$") ? "is-active" : ""}`}
          onClick={toggleQuickPrice}
          disabled={optionCounts.price["$$"] === 0}
          aria-pressed={filters.priceRange.length === 1 && filters.priceRange[0] === "$$"}
          aria-label="Toggle price filter"
        >
          Price ({optionCounts.price["$$"] || 0})
        </button>
        <button
          type="button"
          className={`quickFilterBtn ${filters.dietarySupport.includes("Vegetarian") ? "is-active" : ""}`}
          onClick={toggleQuickDietary}
          disabled={optionCounts.dietary.Vegetarian === 0}
          aria-pressed={filters.dietarySupport.includes("Vegetarian")}
          aria-label="Toggle dietary filter"
        >
          Dietary ({optionCounts.dietary.Vegetarian || 0})
        </button>
        <button
          type="button"
          className={`quickFilterBtn ${filters.distanceEnabled ? "is-active" : ""}`}
          onClick={toggleQuickDistance}
          disabled={effectiveGeo.latitude == null || effectiveGeo.longitude == null}
          aria-pressed={filters.distanceEnabled}
          aria-label="Toggle distance filter"
        >
          Distance
        </button>
        <button type="button" className="quickFilterBtn quickFilterBtn--advanced" onClick={openDrawer} aria-haspopup="dialog" aria-expanded={drawerOpen}>
          Advanced Filters
        </button>
      </div>

      {activeFilterChips.length > 0 && (
        <div className="activeFilterChips" aria-label="Active filters">
          {activeFilterChips.map((chip) => (
            <button key={chip.key} type="button" className="activeFilterChip" onClick={chip.clear}>
              {chip.label}
              <span className="activeFilterChip__x" aria-hidden="true">X</span>
            </button>
          ))}
          <button className="btn btn--ghost" type="button" onClick={resetFilters}>
            Reset Filters
          </button>
        </div>
      )}

      <div className="searchResultsHeader">
        <p className="searchResultsHeader__count">{filteredRestaurants.length} restaurants found</p>
      </div>

      <div className="restaurantGrid">
        {restaurantsLoading ? (
          <LoadingSkeleton variant="card" count={8} className="restaurantGridSkeleton" />
        ) : filteredRestaurants.length === 0 ? (
          <EmptyState
            title="No restaurants match your filters"
            message="Try adjusting filters or reset to browse all available restaurants."
            actionLabel="Reset Filters"
            onAction={resetFilters}
          />
        ) : null}
        {!restaurantsLoading && filteredRestaurants.map((r) => (
          <article
            key={r.id}
            className="restaurantCard restaurantCard--search"
            onClick={() => {
              setSelectedRestaurant(r);
              setDetailsTab("menu");
              setReservationInlineOpen(false);
            }}
          >
            <div className="restaurantCard__cover">
              {(r.coverUrl || r.cover_url)
                ? <img className="restaurantCard__coverImg" src={r.coverUrl || r.cover_url} alt={`${r.name} cover`} />
                : <div className="restaurantCard__coverPlaceholder">No image</div>}
            </div>

            <div className="restaurantCard__body">
              <div className="restaurantCard__header">
                <div className="restaurantCard__name">{r.name}</div>
                <button
                  className={`favoriteHeartBtn ${isFavorited(r.id) ? "is-active" : ""}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!requireAuth()) return;
                    toggleFavorite(r);
                  }}
                  aria-label={isFavorited(r.id) ? "Remove from favorites" : "Add to favorites"}
                >
                  <svg viewBox="0 0 24 24" className="favoriteHeartIcon" aria-hidden="true">
                    <path d="M12 21s-7.2-4.6-9.6-9C.7 8.7 2.1 5.5 5.4 4.6c1.8-.5 3.6.1 4.8 1.4L12 7.8l1.8-1.8c1.2-1.3 3-1.9 4.8-1.4 3.3.9 4.7 4.1 3 7.4C19.2 16.4 12 21 12 21z" />
                  </svg>
                </button>
              </div>

              <div className="restaurantCard__cuisine">{r.cuisine || "Cuisine not set"}</div>
              <div className="restaurantCard__metaLine">Rating {r.rating ?? "N/A"}</div>
              <div className="restaurantCard__metaLine">
                {r.distance_km != null ? `${r.distance_km} km away` : (r.address || "Location unavailable")}
              </div>

              <div className="restaurantCard__actions">
                <button
                  className="btn btn--gold reserveMiniBtn"
                  type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!requireAuth()) return;
              setSelectedRestaurant(r);
              setDetailsTab("menu");
              setReservationInlineOpen(true);
              window.requestAnimationFrame(() => {
                reservationInlineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            }}
          >
            Reserve
          </button>
              </div>
            </div>
          </article>
        ))}

      </div>

      {drawerOpen && (
        <div className="filterDrawer" role="dialog" aria-modal="true" aria-label="Advanced filters">
          <div className="filterDrawer__backdrop" onClick={closeDrawer} />
          <aside className="filterDrawer__panel" ref={drawerRef}>
            <header className="filterDrawer__header">
              <h2>Advanced Filters</h2>
              <button type="button" className="btn btn--ghost" onClick={closeDrawer} aria-label="Close advanced filters">
                Close
              </button>
            </header>

            <div className="filterDrawer__body">
              <section className="filterDrawer__section">
                <label className="filterDrawer__label" htmlFor="drawer-rating">Rating ({drawerFilters.minRating})</label>
                <input
                  id="drawer-rating"
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={drawerFilters.minRating}
                  onChange={(e) => setDrawerFilters((prev) => ({ ...prev, minRating: Number(e.target.value) }))}
                  aria-label="Minimum rating"
                />
              </section>

              <section className="filterDrawer__section">
                <div className="filterDrawer__label">Price Range</div>
                <div className="filterDrawer__options">
                  {PRICE_OPTIONS.map((price) => {
                    const count = optionCounts.price[price] || 0;
                    const selected = drawerFilters.priceRange.includes(price);
                    const disabled = count === 0 && !selected;
                    return (
                      <label key={price} className={`filterOption ${disabled ? "is-disabled" : ""}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={disabled}
                          onChange={() => toggleDrawerArrayFilter("priceRange", price)}
                          aria-label={`Price ${price}`}
                        />
                        <span>{PRICE_LABELS[price] || price} ({count})</span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="filterDrawer__section">
                <div className="filterDrawer__label">Dietary Support</div>
                <div className="filterDrawer__options">
                  {DIETARY_OPTIONS.map((dietary) => {
                    const count = optionCounts.dietary[dietary] || 0;
                    const selected = drawerFilters.dietarySupport.includes(dietary);
                    const disabled = count === 0 && !selected;
                    return (
                      <label key={dietary} className={`filterOption ${disabled ? "is-disabled" : ""}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={disabled}
                          onChange={() => toggleDrawerArrayFilter("dietarySupport", dietary)}
                          aria-label={`Dietary ${dietary}`}
                        />
                        <span>{DIETARY_LABELS[dietary] || dietary} ({count})</span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="filterDrawer__section">
                <div className="filterDrawer__label">Distance Radius</div>
                <label className="filterOption">
                  <input
                    type="checkbox"
                    checked={drawerFilters.distanceEnabled}
                    onChange={(e) => setDrawerFilters((prev) => ({ ...prev, distanceEnabled: e.target.checked }))}
                    disabled={effectiveGeo.latitude == null || effectiveGeo.longitude == null}
                    aria-label="Enable distance radius"
                  />
                  <span>Enable distance filter</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={drawerFilters.distanceRadius}
                  disabled={!drawerFilters.distanceEnabled || effectiveGeo.latitude == null || effectiveGeo.longitude == null}
                  onChange={(e) => setDrawerFilters((prev) => ({ ...prev, distanceRadius: Number(e.target.value) }))}
                  aria-label="Distance radius in kilometers"
                />
                <div className="filterDrawer__hint">{drawerFilters.distanceRadius} km</div>
              </section>

              <section className="filterDrawer__section">
                <div className="filterDrawer__label">Availability</div>
                <div className="filterDrawer__grid">
                  <label className="filterDrawer__field">
                    <span>Date</span>
                    <input
                      type="date"
                      value={drawerFilters.availabilityDate}
                      onChange={(e) => setDrawerFilters((prev) => ({ ...prev, availabilityDate: e.target.value }))}
                      aria-label="Availability date"
                    />
                  </label>
                  <label className="filterDrawer__field">
                    <span>Time</span>
                    <input
                      type="time"
                      value={drawerFilters.availabilityTime}
                      onChange={(e) => setDrawerFilters((prev) => ({ ...prev, availabilityTime: e.target.value }))}
                      aria-label="Availability time"
                    />
                  </label>
                </div>
              </section>

              <section className="filterDrawer__section">
                <label className="filterOption">
                  <input
                    type="checkbox"
                    checked={drawerFilters.verifiedOnly}
                    onChange={(e) => setDrawerFilters((prev) => ({ ...prev, verifiedOnly: e.target.checked }))}
                    aria-label="Verified restaurants only"
                  />
                  <span>Verified only</span>
                </label>
              </section>

              <section className="filterDrawer__section">
                <div className="filterDrawer__label">Cuisine</div>
                <div className="filterDrawer__options filterDrawer__options--multi">
                  {CUISINES.map((cuisine) => {
                    const count = optionCounts.cuisine[cuisine] || 0;
                    const selected = drawerFilters.cuisines.includes(cuisine);
                    const disabled = count === 0 && !selected;
                    return (
                      <label key={cuisine} className={`filterOption ${disabled ? "is-disabled" : ""}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={disabled}
                          onChange={() => toggleDrawerArrayFilter("cuisines", cuisine)}
                          aria-label={`Cuisine ${cuisine}`}
                        />
                        <span>{cuisine} ({count})</span>
                      </label>
                    );
                  })}
                </div>
              </section>
            </div>

            <footer className="filterDrawer__footer">
              <button type="button" className="btn btn--ghost" onClick={() => setDrawerFilters(getInitialFilters())}>Reset</button>
              <button type="button" className="btn btn--gold" onClick={applyDrawerFilters}>Apply Filters</button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}


