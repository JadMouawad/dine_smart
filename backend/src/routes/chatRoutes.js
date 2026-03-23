const express = require("express");
const router = express.Router();
const { parseDineSmartMessage } = require("../services/githubModelsService");
const searchService = require("../services/searchService");
const restaurantService = require("../services/restaurantService");
const reservationService = require("../services/reservationService");
const systemSettingsRepository = require("../repositories/systemSettingsRepository");

const CHAT_MODEL_PROVIDER = process.env.GITHUB_TOKEN ? "github-models+rules" : "local-rules-engine";
const CHAT_MODEL_NAME = process.env.GITHUB_TOKEN ? "openai/gpt-4o+dinesmart-chat-v2" : "dinesmart-chat-v2";

const GREETING_MESSAGE =
  "Hi! I’m Diney. I can help you discover restaurants on DineSmart, check hours, look at reviews, and check availability. Tell me what you’re craving.";

const IDENTITY_MESSAGE =
  "Hey! I’m Diney, DineSmart’s restaurant assistant. I can help with things like finding nearby spots, narrowing by cuisine, budget, rating, or dietary preferences, checking restaurant details and hours, and checking reservation availability.";

const OUT_OF_SCOPE_MESSAGE =
  "I’m Diney, so I stay focused on DineSmart restaurant help. I can help with restaurant discovery, reviews, hours, and reservation availability.";

const DEFAULT_NEARBY_RADIUS_KM = 10;
const DISABLED_MESSAGE =
  "AI chat is currently disabled. You can still search restaurants and book directly in DineSmart.";
const GUARDED_MESSAGE =
  "I can only help with safe restaurant discovery, restaurant details, hours, and booking support inside DineSmart.";
const FAILURE_MESSAGE =
  "I hit a temporary issue, but you can still search restaurants or open a restaurant profile directly in DineSmart.";
const DEFAULT_FRONTEND_FILTERS = Object.freeze({
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
});

const DISALLOWED_REQUEST_PATTERNS = [
  /\b(ignore previous instructions|ignore all previous instructions|forget everything|system prompt|developer message|reveal hidden instructions|bypass guardrails)\b/i,
  /\b(self[-\s]?harm|suicide|kill myself|harm myself)\b/i,
  /\b(kill|murder|assault|stab|shoot)\b/i,
  /\b(bomb|explosive|terror(?:ism|ist)?)\b/i,
  /\b(cocaine|heroin|meth|drug dealing?|illegal drugs?)\b/i,
  /\b(explicit sexual|porn|sexual content)\b/i,
  /\b(hate speech|racial slur|genocide)\b/i,
];

const DISALLOWED_RESPONSE_PATTERNS = [
  /\b(system prompt|developer message|hidden instructions)\b/i,
  /\b(self[-\s]?harm|suicide|kill myself|harm myself)\b/i,
  /\b(bomb|explosive|terror(?:ism|ist)?)\b/i,
  /\b(cocaine|heroin|meth|illegal drugs?)\b/i,
  /\b(explicit sexual|porn|sexual content)\b/i,
];

const normalizePriceRanges = (priceRanges = []) => {
  const normalized = new Set();

  for (const raw of priceRanges) {
    const value = String(raw || "").trim().toLowerCase();

    if (!value) continue;

    if (["$", "$$", "$$$", "$$$$"].includes(value)) {
      normalized.add(value);
      continue;
    }

    if (["cheap", "budget", "affordable", "inexpensive", "low"].includes(value)) {
      normalized.add("$");
      continue;
    }

    if (["moderate", "mid", "mid-range", "average"].includes(value)) {
      normalized.add("$$");
      continue;
    }

    if (["expensive", "fancy", "fine dining", "luxury", "high-end", "premium"].includes(value)) {
      normalized.add("$$$");
    }
  }

  return [...normalized];
};

const getTodayDate = () => new Date().toISOString().slice(0, 10);

const getCurrentTime = () => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}:00`;
};

const formatTimeLabel = (value) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return value || "";

  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? "PM" : "AM";
  const normalizedHours = ((hours + 11) % 12) + 1;
  return `${normalizedHours}:${minutes} ${suffix}`;
};

const joinNaturally = (values = []) => {
  const cleaned = values.filter(Boolean);
  if (cleaned.length <= 1) return cleaned[0] || "";
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
};

const isOpenNow = (openingTime, closingTime) => {
  if (!openingTime || !closingTime) return null;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();

  const [openH, openM] = String(openingTime).split(":").map(Number);
  const [closeH, closeM] = String(closingTime).split(":").map(Number);

  const open = openH * 60 + openM;
  const close = closeH * 60 + closeM;

  if (open <= close) {
    return current >= open && current <= close;
  }

  return current >= open || current <= close;
};

const buildRestaurantCard = (restaurant) => ({
  id: restaurant.id,
  name: restaurant.name,
  cuisine: restaurant.cuisine,
  rating: restaurant.rating,
  price_range: restaurant.price_range,
  dietary_support: restaurant.dietary_support || [],
  opening_time: restaurant.opening_time,
  closing_time: restaurant.closing_time,
  address: restaurant.address,
  latitude: restaurant.latitude,
  longitude: restaurant.longitude,
  distance_km: restaurant.distance_km,
  review_count: restaurant.review_count,
  active_event_count: restaurant.active_event_count,
  popularity_score: restaurant.popularity_score,
  available_seats: restaurant.available_seats,
});

const budgetLabelMap = {
  "$": "budget-friendly",
  "$$": "moderately priced",
  "$$$": "upscale",
  "$$$$": "luxury",
};

const describeSearchRequest = (parsed = {}) => {
  const phrases = [];

  if (parsed.cuisines?.length) {
    phrases.push(`${joinNaturally(parsed.cuisines)} spots`);
  } else {
    phrases.push("restaurants");
  }

  if (parsed.priceRanges?.length) {
    const budgetLabels = parsed.priceRanges.map((value) => budgetLabelMap[value] || value);
    phrases.push(joinNaturally(budgetLabels));
  }

  if (parsed.dietarySupport?.length) {
    phrases.push(`${joinNaturally(parsed.dietarySupport)}-friendly`);
  }

  if (parsed.minRating != null) {
    phrases.push(`${parsed.minRating}+ rated`);
  }

  if (parsed.maxRating != null) {
    phrases.push(parsed.maxRating <= 1 ? "1★ rated" : `${parsed.maxRating}★ and below`);
  }

  if (parsed.openNow) {
    phrases.push("open right now");
  }

  if (parsed.useProximity) {
    phrases.push(parsed.distanceRadiusKm != null ? `within ${parsed.distanceRadiusKm} km` : "near you");
  }

  return phrases;
};

const buildSearchMessage = ({ parsed, restaurants, locationApplied = false, locationMissing = false }) => {
  const request = describeSearchRequest(parsed);

  if (!restaurants.length) {
    const qualifier = request.length ? ` for ${joinNaturally(request)}` : "";
    if (locationMissing && parsed.useProximity) {
      return `I couldn’t find a strong match${qualifier}. I also don’t have your location yet, so I couldn’t truly do a nearby search.`;
    }
    return `I couldn’t find a strong match${qualifier} right now. I can broaden the search if you want.`;
  }

  const shown = restaurants.slice(0, 5);
  const locationPrefix = locationMissing && parsed.useProximity
    ? "I don’t have your location yet, so I’m showing the best matches I could find instead of true nearby results. "
    : "";

  const snippets = shown.map((restaurant) => {
    const bits = [
      restaurant.cuisine,
      restaurant.price_range,
      restaurant.rating != null ? `${Number(restaurant.rating).toFixed(1)}★` : "",
      locationApplied && restaurant.distance_km != null ? `${Number(restaurant.distance_km).toFixed(1)} km away` : "",
    ].filter(Boolean);

    return bits.length
      ? `${restaurant.name} (${bits.join(" • ")})`
      : restaurant.name;
  });

  if (shown.length === 1) {
    return `${locationPrefix}I found 1 match: ${snippets[0]}.`;
  }

  return `${locationPrefix}I found ${restaurants.length} match${restaurants.length === 1 ? "" : "es"}: ${joinNaturally(snippets)}.`;
};

const buildSearchSuggestions = ({ parsed, restaurants, locationMissing = false }) => {
  if (!restaurants.length) {
    const suggestions = [
      "Broaden the cuisine",
      "Try a different budget",
      "Show anything open now",
      "Search by restaurant name",
    ];

    if (locationMissing && parsed.useProximity) {
      suggestions.unshift("Share your location for nearby results");
    }

    return suggestions.slice(0, 4);
  }

  const suggestions = [];
  if (locationMissing && parsed.useProximity) suggestions.push("Share your location for nearby results");
  if (!parsed.priceRanges?.length) suggestions.push("Filter by budget");
  if (!parsed.dietarySupport?.length) suggestions.push("Add vegan, halal, or vegetarian");
  if (!parsed.openNow) suggestions.push("Show only open now");
  suggestions.push("Check availability at one of these");

  return suggestions.slice(0, 4);
};

const buildPopularityText = (restaurant) => {
  const rating = Number(restaurant.rating || 0);
  const reviews = Number(restaurant.review_count || 0);

  if (rating >= 4.5 && reviews >= 50) {
    return `${restaurant.name} looks very well-loved — it’s sitting at ${rating.toFixed(1)}★ across ${reviews} reviews.`;
  }

  if (rating >= 4.0 && reviews >= 10) {
    return `${restaurant.name} seems to be a solid pick. It has a ${rating.toFixed(1)}★ rating${reviews ? ` from ${reviews} reviews` : ""}.`;
  }

  if (rating > 0) {
    return `${restaurant.name} currently has a ${rating.toFixed(1)}★ rating${reviews ? ` from ${reviews} reviews` : ""}, so there’s at least some diner feedback to go on.`;
  }

  return `I found ${restaurant.name}, but I don’t have enough review data yet to say how popular it is.`;
};

const buildReviewText = (userMessage, restaurant) => {
  const lowerMessage = String(userMessage || "").toLowerCase();
  const rating = Number(restaurant.rating || 0);
  const reviews = Number(restaurant.review_count || 0);
  const asksNegativeReviews = /\b(bad|negative|poor|terrible|awful|worst|low rated|low-rated)\b/.test(lowerMessage);

  if (reviews <= 0 || rating <= 0) {
    return `I found ${restaurant.name}, but there isn’t enough review data on DineSmart yet to say whether it has good or bad reviews.`;
  }

  if (asksNegativeReviews) {
    if (rating <= 2.5) {
      return `Yes — ${restaurant.name} has some fairly weak feedback right now, with a ${rating.toFixed(1)}★ rating across ${reviews} reviews.`;
    }
    if (rating >= 4) {
      return `Not really — ${restaurant.name} is actually reviewing well on DineSmart, with a ${rating.toFixed(1)}★ rating across ${reviews} reviews.`;
    }
    return `${restaurant.name} looks mixed rather than clearly bad right now, with a ${rating.toFixed(1)}★ rating across ${reviews} reviews.`;
  }

  return `${restaurant.name} currently has a ${rating.toFixed(1)}★ rating across ${reviews} reviews on DineSmart.`;
};

const buildRestaurantDetailsMessage = (userMessage, restaurant) => {
  const lowerMessage = String(userMessage || "").toLowerCase();
  const asksPopularity = /\b(loved|popular|good|great|worth|liked|recommended|recommend)\b/.test(lowerMessage);
  const asksReviews = /\b(review|reviews|rating|ratings|rated|star|stars|bad)\b/.test(lowerMessage);

  if (asksReviews) {
    return buildReviewText(userMessage, restaurant);
  }

  if (asksPopularity) {
    return buildPopularityText(restaurant);
  }

  const details = [restaurant.cuisine, restaurant.price_range].filter(Boolean).join(" • ");
  return `I found ${restaurant.name}${details ? ` (${details})` : ""}. ${restaurant.address ? `It’s located at ${restaurant.address}.` : ""}`.trim();
};

const buildHoursMessage = (restaurant, requestedOpenNow = false) => {
  if (!restaurant.opening_time || !restaurant.closing_time) {
    return `I found ${restaurant.name}, but I don’t have its hours yet.`;
  }

  const openStatus = isOpenNow(restaurant.opening_time, restaurant.closing_time);
  const hoursText = `${formatTimeLabel(restaurant.opening_time)} to ${formatTimeLabel(restaurant.closing_time)}`;

  if (requestedOpenNow) {
    if (openStatus === true) {
      return `Yes — ${restaurant.name} is open right now. Today’s hours are ${hoursText}.`;
    }
    if (openStatus === false) {
      return `No — ${restaurant.name} isn’t open right now. Today’s hours are ${hoursText}.`;
    }
  }

  if (openStatus === true) {
    return `${restaurant.name} is currently open. Its hours are ${hoursText}.`;
  }
  if (openStatus === false) {
    return `${restaurant.name} is currently closed. Its hours are ${hoursText}.`;
  }

  return `${restaurant.name} is open from ${hoursText}.`;
};

const buildAvailabilityMessage = ({ restaurant, availability, partySize }) => {
  const when = `${availability.reservation_date} at ${formatTimeLabel(availability.reservation_time)}`;
  const suggestions = availability.suggested_times?.length
    ? ` Nearby times that may work: ${joinNaturally(availability.suggested_times.map(formatTimeLabel))}.`
    : "";

  if (availability.is_outside_operating_hours) {
    return `${restaurant.name} isn’t serving reservations at ${formatTimeLabel(availability.reservation_time)}. Its hours are ${formatTimeLabel(restaurant.opening_time)} to ${formatTimeLabel(restaurant.closing_time)}.${suggestions}`;
  }

  if (availability.is_fully_booked) {
    return `${restaurant.name} is fully booked on ${when}.${suggestions}`;
  }

  if (partySize != null) {
    if (availability.can_accommodate_party) {
      return `${restaurant.name} can accommodate a party of ${partySize} on ${when}. There ${availability.available_seats === 1 ? "is" : "are"} ${availability.available_seats} seat${availability.available_seats === 1 ? "" : "s"} still available at that time.`;
    }

    return `${restaurant.name} has ${availability.available_seats} seats left on ${when}, so it can’t seat a party of ${partySize} at that exact time.${suggestions}`;
  }

  return `${restaurant.name} has ${availability.available_seats} seat${availability.available_seats === 1 ? "" : "s"} available on ${when}.${suggestions}`;
};

const parseCoordinate = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractLocationContext = (req) => {
  const body = req.body || {};
  const locationSource = body.location || body.context?.location || body.userLocation || {};
  const latitude = parseCoordinate(
    locationSource.latitude ?? body.latitude ?? req.query?.latitude ?? req.user?.latitude
  );
  const longitude = parseCoordinate(
    locationSource.longitude ?? body.longitude ?? req.query?.longitude ?? req.user?.longitude
  );

  return {
    latitude,
    longitude,
    hasCoordinates: latitude != null && longitude != null,
  };
};

const createResponseMeta = (timings) =>
  process.env.NODE_ENV === "production" ? undefined : { timings_ms: timings };

const includesAnyPattern = (text, patterns) =>
  patterns.some((pattern) => pattern.test(String(text || "")));

const isConfigAiEnabled = () => {
  const raw = String(process.env.AI_CHAT_ENABLED ?? "true").trim().toLowerCase();
  return !["0", "false", "off", "disabled", "no"].includes(raw);
};

const getAiAvailability = async () => {
  if (!isConfigAiEnabled()) {
    return { enabled: false, source: "config" };
  }

  const setting = await systemSettingsRepository.getAiChatSetting();
  if (!setting.enabled) {
    return { enabled: false, source: "admin" };
  }

  return { enabled: true, source: "active" };
};

const normalizeDietarySupport = (values = []) => {
  const mapping = {
    vegetarian: "vegetarian",
    vegan: "vegan",
    halal: "halal",
    gf: "gluten-free",
    "gluten-free": "gluten-free",
    "gluten free": "gluten-free",
    "dairy-free": "dairy-free",
    "dairy free": "dairy-free",
    kosher: "kosher",
  };

  return [...new Set(values
    .map((value) => String(value || "").trim().toLowerCase())
    .map((value) => mapping[value] || value)
    .filter(Boolean))];
};

const normalizeFrontendSort = (sortBy = "", useLocationFilters = false) => {
  const normalized = String(sortBy || "").trim().toLowerCase();
  if (["distance", "reviews", "popularity", "alphabetical", "rating_asc"].includes(normalized)) {
    return normalized;
  }
  if (normalized === "rating_desc") return "rating";
  return useLocationFilters ? "distance" : "rating";
};

const buildFrontendFilters = ({ parsed = {}, useLocationFilters = false }) => ({
  ...DEFAULT_FRONTEND_FILTERS,
  minRating: parsed.minRating ?? DEFAULT_FRONTEND_FILTERS.minRating,
  priceRange: normalizePriceRanges(parsed.priceRanges || []),
  dietarySupport: normalizeDietarySupport(parsed.dietarySupport || []),
  openNow: parsed.openNow === true,
  availabilityDate: parsed.availabilityDate || "",
  availabilityTime: String(parsed.availabilityTime || "").slice(0, 5),
  distanceEnabled: Boolean(useLocationFilters),
  distanceRadius: useLocationFilters
    ? parsed.distanceRadiusKm || DEFAULT_NEARBY_RADIUS_KM
    : DEFAULT_FRONTEND_FILTERS.distanceRadius,
  cuisines: Array.isArray(parsed.cuisines) ? parsed.cuisines.filter(Boolean) : [],
  sortBy: normalizeFrontendSort(parsed.sortBy, useLocationFilters),
});

const hasMeaningfulFilters = (filters = {}) => (
  Number(filters.minRating || 0) > 0
  || Boolean(filters.openNow)
  || Boolean(filters.availabilityDate)
  || Boolean(filters.availabilityTime)
  || Boolean(filters.distanceEnabled)
  || (Array.isArray(filters.priceRange) && filters.priceRange.length > 0)
  || (Array.isArray(filters.dietarySupport) && filters.dietarySupport.length > 0)
  || (Array.isArray(filters.cuisines) && filters.cuisines.length > 0)
  || (filters.sortBy && filters.sortBy !== "rating")
);

const createAction = (type, label, payload = {}) => ({
  id: `${type}:${payload.restaurantId || payload.query || label}`.toLowerCase().replace(/\s+/g, "-"),
  type,
  label,
  payload,
});

const dedupeActions = (actions = []) => {
  const seen = new Set();
  return actions.filter((action) => {
    const key = `${action.type}:${JSON.stringify(action.payload || {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildResponseActions = ({ parsed = {}, restaurants = [], restaurant = null, frontendFilters, query = "" }) => {
  const resolvedRestaurants = restaurants.length ? restaurants : (restaurant ? [restaurant] : []);
  const primaryRestaurant = resolvedRestaurants[0] || null;
  const actions = [
    createAction("search_restaurants", "Search restaurants", {
      query,
      filters: frontendFilters,
    }),
  ];

  if (hasMeaningfulFilters(frontendFilters)) {
    actions.push(createAction("apply_filters", "Apply filters", {
      query,
      filters: frontendFilters,
    }));
  }

  if (primaryRestaurant) {
    actions.push(createAction("view_restaurant", "View restaurant", {
      restaurantId: primaryRestaurant.id,
    }));
    actions.push(createAction("book_table", "Book a table", {
      restaurantId: primaryRestaurant.id,
      restaurantName: primaryRestaurant.name,
      reservationDate: parsed.availabilityDate || "",
      reservationTime: String(parsed.availabilityTime || "").slice(0, 5),
      partySize: parsed.partySize || null,
    }));
  }

  return dedupeActions(actions).slice(0, 4);
};

const sanitizeChatPayload = (payload = {}) => {
  const normalized = {
    ...payload,
    restaurants: Array.isArray(payload.restaurants) ? payload.restaurants : [],
    actions: Array.isArray(payload.actions) ? payload.actions : [],
    suggestions: Array.isArray(payload.suggestions) ? payload.suggestions : [],
  };

  const candidateStrings = [
    normalized.message,
    ...normalized.suggestions,
    ...normalized.actions.map((action) => action.label),
  ];

  if (!candidateStrings.some((value) => includesAnyPattern(value, DISALLOWED_RESPONSE_PATTERNS))) {
    return normalized;
  }

  return {
    message: GUARDED_MESSAGE,
    parsed: { intent: "guardrail" },
    restaurants: [],
    actions: [
      createAction("search_restaurants", "Search restaurants", {
        query: "",
        filters: DEFAULT_FRONTEND_FILTERS,
      }),
    ],
    suggestions: ["Search restaurants"],
    blocked: true,
    metadata: {
      model_provider: CHAT_MODEL_PROVIDER,
      model_name: CHAT_MODEL_NAME,
    },
  };
};

const sendSafeJson = (res, payload, status = 200) =>
  res.status(status).json(sanitizeChatPayload(payload));

router.post("/chat", async (req, res) => {
  const routeStartedAt = Date.now();
  const timings = {};

  const mark = (label, startedAt) => {
    timings[label] = Date.now() - startedAt;
  };

  try {
    const { message } = req.body || {};
    const trimmedMessage = String(message || "").trim();
    const baseFilters = buildFrontendFilters({ parsed: {}, useLocationFilters: false });

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    if (includesAnyPattern(trimmedMessage, DISALLOWED_REQUEST_PATTERNS)) {
      return sendSafeJson(res, {
        message: GUARDED_MESSAGE,
        parsed: { intent: "guardrail" },
        restaurants: [],
        actions: [
          createAction("search_restaurants", "Search restaurants", {
            query: "",
            filters: baseFilters,
          }),
          createAction("apply_filters", "Apply filters", {
            query: "",
            filters: { ...baseFilters, openNow: true },
          }),
        ],
        actions: [
          createAction("search_restaurants", "Search restaurants", {
            query: "",
            filters: baseFilters,
          }),
        ],
        suggestions: [
          "Search restaurants",
          "Apply filters",
          "Book a table",
        ],
        blocked: true,
        metadata: {
          model_provider: CHAT_MODEL_PROVIDER,
          model_name: CHAT_MODEL_NAME,
        },
        meta: createResponseMeta({ ...timings, total: Date.now() - routeStartedAt, blocked: true }),
      });
    }

    const aiStatusStartedAt = Date.now();
    const aiAvailability = await getAiAvailability();
    mark("ai_status", aiStatusStartedAt);

    if (!aiAvailability.enabled) {
      return sendSafeJson(res, {
        message: DISABLED_MESSAGE,
        parsed: { intent: "disabled" },
        restaurants: [],
        actions: [
          createAction("search_restaurants", "Search restaurants", {
            query: "",
            filters: baseFilters,
          }),
          createAction("apply_filters", "Apply filters", {
            query: "",
            filters: baseFilters,
          }),
        ],
        suggestions: [
          "Search restaurants",
          "Apply filters",
        ],
        blocked: true,
        ai_disabled: true,
        metadata: {
          model_provider: CHAT_MODEL_PROVIDER,
          model_name: CHAT_MODEL_NAME,
        },
        meta: createResponseMeta({
          ...timings,
          total: Date.now() - routeStartedAt,
          disabled_source: aiAvailability.source,
        }),
      });
    }

    const parseStartedAt = Date.now();
    const parsed = await parseDineSmartMessage(trimmedMessage);
    mark("parse", parseStartedAt);

    if (parsed.greeting) {
      return sendSafeJson(res, {
        message: GREETING_MESSAGE,
        parsed,
        restaurants: [],
        suggestions: [
          "Find Italian restaurants",
          "What’s open now?",
          "Check a restaurant’s hours",
          "See availability tonight",
        ],
        metadata: {
          model_provider: CHAT_MODEL_PROVIDER,
          model_name: CHAT_MODEL_NAME,
        },
        meta: createResponseMeta({ ...timings, total: Date.now() - routeStartedAt }),
      });
    }

    if (parsed.identityQuestion || parsed.intent === "identity") {
      return sendSafeJson(res, {
        message: IDENTITY_MESSAGE,
        parsed,
        restaurants: [],
        actions: [
          createAction("search_restaurants", "Search restaurants", {
            query: "",
            filters: baseFilters,
          }),
          createAction("apply_filters", "Apply filters", {
            query: "",
            filters: { ...baseFilters, openNow: true },
          }),
        ],
        suggestions: [
          "Restaurants near me",
          "Show affordable sushi",
          "Check Victoria’s hours",
          "See availability for 2 tonight",
        ],
        metadata: {
          model_provider: CHAT_MODEL_PROVIDER,
          model_name: CHAT_MODEL_NAME,
        },
        meta: createResponseMeta({ ...timings, total: Date.now() - routeStartedAt }),
      });
    }

    if (parsed.outOfScope) {
      return sendSafeJson(res, {
        message: OUT_OF_SCOPE_MESSAGE,
        parsed,
        restaurants: [],
        actions: [
          createAction("search_restaurants", "Search restaurants", {
            query: "",
            filters: baseFilters,
          }),
          createAction("apply_filters", "Apply filters", {
            query: "",
            filters: { ...baseFilters, openNow: true },
          }),
        ],
        suggestions: [
          "Restaurants near me",
          "Is Victoria open now?",
          "Check availability tonight",
          "Show vegan restaurants",
        ],
        blocked: true,
        metadata: {
          model_provider: CHAT_MODEL_PROVIDER,
          model_name: CHAT_MODEL_NAME,
        },
        meta: createResponseMeta({ ...timings, total: Date.now() - routeStartedAt }),
      });
    }

    if (parsed.needsClarification) {
      const maybeRestaurantName = String(message || "").trim();

      if (maybeRestaurantName && maybeRestaurantName.split(/\s+/).length <= 5) {
        const lookupStartedAt = Date.now();
        const rescuedRestaurant = await restaurantService.findRestaurantByName(maybeRestaurantName);
        mark("restaurant_lookup", lookupStartedAt);

        if (rescuedRestaurant) {
          const rescuedCard = buildRestaurantCard(rescuedRestaurant);
          const rescuedParsed = {
            ...parsed,
            intent: "restaurant_details",
            restaurantName: rescuedRestaurant.name,
            needsClarification: false,
            clarificationQuestion: "",
          };

          return sendSafeJson(res, {
            message: buildRestaurantDetailsMessage(message, rescuedRestaurant),
            parsed: rescuedParsed,
            restaurant: rescuedCard,
            restaurants: [rescuedCard],
            actions: buildResponseActions({
              parsed: rescuedParsed,
              restaurant: rescuedCard,
              frontendFilters: buildFrontendFilters({ parsed: rescuedParsed, useLocationFilters: false }),
              query: rescuedRestaurant.name,
            }),
            suggestions: [
              "Check availability there",
              "Is it open now?",
              "Show similar places",
              "See highly rated options",
            ],
            metadata: {
              model_provider: CHAT_MODEL_PROVIDER,
              model_name: CHAT_MODEL_NAME,
            },
            meta: createResponseMeta({ ...timings, total: Date.now() - routeStartedAt }),
          });
        }
      }

      return sendSafeJson(res, {
        message:
          parsed.clarificationQuestion ||
          "Tell me a restaurant name, cuisine, budget, or whether you want hours or availability.",
        parsed,
        restaurants: [],
        actions: [
          createAction("search_restaurants", "Search restaurants", {
            query: "",
            filters: baseFilters,
          }),
          createAction("apply_filters", "Apply filters", {
            query: "",
            filters: buildFrontendFilters({ parsed, useLocationFilters: false }),
          }),
        ],
        suggestions: [
          "Affordable sushi",
          "Open now",
          "Victoria",
          "Availability tonight for 4",
        ],
        metadata: {
          model_provider: CHAT_MODEL_PROVIDER,
          model_name: CHAT_MODEL_NAME,
        },
        meta: createResponseMeta({ ...timings, total: Date.now() - routeStartedAt }),
      });
    }

    if (parsed.intent === "hours_check" || parsed.intent === "restaurant_details") {
      if (!parsed.restaurantName) {
        return sendSafeJson(res, {
          message: "Which restaurant would you like me to check?",
          parsed,
          restaurants: [],
          actions: [
            createAction("search_restaurants", "Search restaurants", {
              query: "",
              filters: baseFilters,
            }),
          ],
          suggestions: ["Victoria", "Sushi World", "Curry Palace"],
          metadata: {
            model_provider: CHAT_MODEL_PROVIDER,
            model_name: CHAT_MODEL_NAME,
          },
          meta: createResponseMeta({ ...timings, total: Date.now() - routeStartedAt }),
        });
      }

      const lookupStartedAt = Date.now();
      const restaurant = await restaurantService.findRestaurantByName(parsed.restaurantName);
      mark("restaurant_lookup", lookupStartedAt);

      if (!restaurant) {
        return sendSafeJson(res, {
          message: `I couldn’t find a restaurant named “${parsed.restaurantName}.”`,
          parsed,
          restaurants: [],
          actions: [
            createAction("search_restaurants", "Search restaurants", {
              query: parsed.restaurantName,
              filters: baseFilters,
            }),
          ],
          suggestions: ["Check the spelling", "Try another restaurant name"],
          metadata: {
            model_provider: CHAT_MODEL_PROVIDER,
            model_name: CHAT_MODEL_NAME,
          },
          meta: createResponseMeta({ ...timings, total: Date.now() - routeStartedAt }),
        });
      }

      const detailCard = buildRestaurantCard(restaurant);
      const detailParsed = {
        ...parsed,
        restaurantName: restaurant.name,
      };

      return sendSafeJson(res, {
        message:
          parsed.intent === "hours_check"
            ? buildHoursMessage(restaurant, parsed.openNow)
            : buildRestaurantDetailsMessage(message, restaurant),
        parsed: detailParsed,
        restaurant: detailCard,
        restaurants: [detailCard],
        actions: buildResponseActions({
          parsed: detailParsed,
          restaurant: detailCard,
          frontendFilters: buildFrontendFilters({ parsed: detailParsed, useLocationFilters: false }),
          query: restaurant.name,
        }),
        suggestions: [
          "Check availability there",
          "Show similar restaurants",
          "What’s open now?",
          "See highly rated spots",
        ],
        metadata: {
          model_provider: CHAT_MODEL_PROVIDER,
          model_name: CHAT_MODEL_NAME,
        },
        meta: createResponseMeta({ ...timings, total: Date.now() - routeStartedAt }),
      });
    }

    if (parsed.intent === "availability_check") {
      if (!parsed.restaurantName) {
        return sendSafeJson(res, {
          message: "Which restaurant would you like me to check availability for?",
          parsed,
          restaurants: [],
          actions: [
            createAction("search_restaurants", "Search restaurants", {
              query: "",
              filters: baseFilters,
            }),
          ],
          suggestions: ["Victoria tonight for 2", "Sushi World at 8 PM", "Curry Palace tomorrow"],
          metadata: {
            model_provider: CHAT_MODEL_PROVIDER,
            model_name: CHAT_MODEL_NAME,
          },
          meta: createResponseMeta({ ...timings, total: Date.now() - routeStartedAt }),
        });
      }

      const lookupStartedAt = Date.now();
      const restaurant = await restaurantService.findRestaurantByName(parsed.restaurantName);
      mark("restaurant_lookup", lookupStartedAt);

      if (!restaurant) {
        return sendSafeJson(res, {
          message: `I couldn’t find a restaurant named “${parsed.restaurantName}.”`,
          parsed,
          restaurants: [],
          actions: [
            createAction("search_restaurants", "Search restaurants", {
              query: parsed.restaurantName,
              filters: baseFilters,
            }),
          ],
          suggestions: ["Check the spelling", "Try another restaurant name"],
          metadata: {
            model_provider: CHAT_MODEL_PROVIDER,
            model_name: CHAT_MODEL_NAME,
          },
          meta: createResponseMeta({ ...timings, total: Date.now() - routeStartedAt }),
        });
      }

      const reservationDate = parsed.availabilityDate || getTodayDate();
      const reservationTime = parsed.availabilityTime || getCurrentTime();
      const requestedPartySize = parsed.partySize;
      const effectivePartySize = requestedPartySize || 1;

      const availabilityStartedAt = Date.now();
      const result = await reservationService.getAvailability({
        restaurantId: restaurant.id,
        reservationDate,
        reservationTime,
        partySize: effectivePartySize,
      });
      mark("availability_lookup", availabilityStartedAt);

      const availabilityCard = buildRestaurantCard(restaurant);

      if (!result.success) {
        return sendSafeJson(res, {
          message: result.error,
          parsed,
          restaurant: availabilityCard,
          restaurants: [availabilityCard],
          actions: buildResponseActions({
            parsed,
            restaurant: availabilityCard,
            frontendFilters: buildFrontendFilters({ parsed, useLocationFilters: false }),
            query: restaurant.name,
          }),
          suggestions: ["Try another time", "Reduce the party size", "Check tomorrow instead"],
          metadata: {
            model_provider: CHAT_MODEL_PROVIDER,
            model_name: CHAT_MODEL_NAME,
          },
          meta: createResponseMeta({ ...timings, total: Date.now() - routeStartedAt }),
        });
      }

      return sendSafeJson(res, {
        message: buildAvailabilityMessage({
          restaurant,
          availability: result.availability,
          partySize: requestedPartySize ?? null,
        }),
        parsed,
        restaurant: availabilityCard,
        restaurants: [availabilityCard],
        availability: result.availability,
        actions: buildResponseActions({
          parsed,
          restaurant: availabilityCard,
          frontendFilters: buildFrontendFilters({ parsed, useLocationFilters: false }),
          query: restaurant.name,
        }),
        suggestions: result.availability.suggested_times?.length
          ? result.availability.suggested_times.map(formatTimeLabel)
          : ["Try a different time", "Try another date"],
        metadata: {
          model_provider: CHAT_MODEL_PROVIDER,
          model_name: CHAT_MODEL_NAME,
        },
        meta: createResponseMeta({ ...timings, total: Date.now() - routeStartedAt }),
      });
    }

    const locationContext = extractLocationContext(req);
    const useLocationFilters = parsed.useProximity && locationContext.hasCoordinates;
    const locationMissing = parsed.useProximity && !locationContext.hasCoordinates;

    const filters = {
      priceRanges: normalizePriceRanges(parsed.priceRanges || []),
      dietarySupport: normalizeDietarySupport(parsed.dietarySupport || []),
      minRating: parsed.minRating,
      maxRating: parsed.maxRating,
      openNow: parsed.openNow === true,
      availabilityDate: parsed.availabilityDate || null,
      availabilityTime: parsed.availabilityTime || null,
      partySize: parsed.partySize || null,
      latitude: useLocationFilters ? locationContext.latitude : null,
      longitude: useLocationFilters ? locationContext.longitude : null,
      distanceRadius: useLocationFilters
        ? parsed.distanceRadiusKm || DEFAULT_NEARBY_RADIUS_KM
        : null,
      sortBy: parsed.sortBy || (useLocationFilters ? "distance" : "rating"),
      verifiedOnly: true,
    };

    const searchStartedAt = Date.now();
    let restaurants = await searchService.searchRestaurants({
      query: parsed.restaurantName || "",
      cuisines: parsed.cuisines || [],
      filters,
    });

    const lowerMessage = String(message || "").toLowerCase();

    const looksLikeBestSearch =
      parsed.sortBy === "rating_desc" &&
      parsed.minRating === 5 &&
      /\b(best|top|highest rated|top rated|best rated)\b/.test(lowerMessage);

    const looksLikeWorstSearch =
      parsed.sortBy === "rating_asc" &&
      parsed.maxRating === 1 &&
      /\b(worst|lowest rated|one star|1 star)\b/.test(lowerMessage);

    if (!restaurants.length && looksLikeBestSearch) {
      restaurants = await searchService.searchRestaurants({
        query: parsed.restaurantName || "",
        cuisines: parsed.cuisines || [],
        filters: {
          ...filters,
          minRating: 4,
          sortBy: "rating_desc",
        },
      });
    }

    if (!restaurants.length && looksLikeWorstSearch) {
      restaurants = await searchService.searchRestaurants({
        query: parsed.restaurantName || "",
        cuisines: parsed.cuisines || [],
        filters: {
          ...filters,
          maxRating: 2.5,
          sortBy: "rating_asc",
        },
      });
    }

    mark("search", searchStartedAt);

    const cards = restaurants.slice(0, 5).map(buildRestaurantCard);
    const total = Date.now() - routeStartedAt;

    if (total > 1500) {
      console.info("[chat] slow request", {
        total_ms: total,
        timings_ms: timings,
        message: String(message).slice(0, 120),
      });
    }

    const frontendFilters = buildFrontendFilters({ parsed, useLocationFilters });

    return sendSafeJson(res, {
      message: buildSearchMessage({
        parsed,
        restaurants: cards,
        locationApplied: useLocationFilters,
        locationMissing,
      }),
      parsed,
      restaurants: cards,
      actions: buildResponseActions({
        parsed,
        restaurants: cards,
        frontendFilters,
        query: parsed.restaurantName || "",
      }),
      suggestions: buildSearchSuggestions({
        parsed,
        restaurants: cards,
        locationMissing,
      }),
      metadata: {
        model_provider: CHAT_MODEL_PROVIDER,
        model_name: CHAT_MODEL_NAME,
      },
      meta: createResponseMeta({
        ...timings,
        total,
        location_used: useLocationFilters,
        location_missing: locationMissing,
      }),
    });
  } catch (error) {
    console.error("Chat route error:", error);
    return sendSafeJson(res, {
      message: FAILURE_MESSAGE,
      parsed: { intent: "fallback" },
      restaurants: [],
      actions: [
        createAction("search_restaurants", "Search restaurants", {
          query: "",
          filters: DEFAULT_FRONTEND_FILTERS,
        }),
        createAction("apply_filters", "Apply filters", {
          query: "",
          filters: DEFAULT_FRONTEND_FILTERS,
        }),
      ],
      suggestions: [
        "Search restaurants",
        "Apply filters",
      ],
      blocked: true,
      metadata: {
        model_provider: CHAT_MODEL_PROVIDER,
        model_name: CHAT_MODEL_NAME,
      },
      meta: createResponseMeta({ total: Date.now() - routeStartedAt, fallback: true }),
    });
  }
});

module.exports = router;
module.exports.__testables = {
  buildRestaurantDetailsMessage,
};
