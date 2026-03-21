const chatRepository = require("../repositories/chatRepository");
const restaurantRepository = require("../repositories/restaurantRepository");

const MODEL_PROVIDER = "local-rules-engine";
const MODEL_NAME = "dinesmart-assistant-mvp-v1";
const MAX_RESULTS = 5;

const KNOWN_CUISINES = [
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

const KNOWN_DIETARY = ["Vegetarian", "Vegan", "Halal", "GF"];
const UNSAFE_PATTERNS = [
  /hate/i,
  /violent/i,
  /self[-\s]?harm/i,
  /suicide/i,
  /kill/i,
  /explicit sexual/i,
  /terror/i,
  /drugs?/i,
];

const normalizeText = (value) => String(value || "").trim();

const parseNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim());
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const includesAny = (text, patterns) => patterns.some((pattern) => pattern.test(text));

const detectCuisineFilters = (message) => {
  const lower = message.toLowerCase();
  return KNOWN_CUISINES.filter((cuisine) => lower.includes(cuisine.toLowerCase()));
};

const detectDietaryFilters = (message) => {
  const lower = message.toLowerCase();
  return KNOWN_DIETARY.filter((diet) => {
    if (diet === "GF") return /gluten[-\s]?free|\bgf\b/i.test(lower);
    return lower.includes(diet.toLowerCase());
  });
};

const detectPriceFilters = (message) => {
  const lower = message.toLowerCase();
  const values = [];
  if (/cheap|budget|affordable|low[-\s]?cost/i.test(lower)) values.push("$");
  if (/moderate|mid[-\s]?range|casual/i.test(lower)) values.push("$$");
  if (/premium|fancy|upscale/i.test(lower)) values.push("$$$");
  if (/luxury|fine dining|high[-\s]?end/i.test(lower)) values.push("$$$$");
  return [...new Set(values)];
};

const detectDistanceRadius = (message, explicitRadius) => {
  if (parseNumber(explicitRadius, null) != null) return parseNumber(explicitRadius, null);
  const match = String(message).match(/(within|under|inside)\s+(\d{1,3})\s*(km|kilometers?)/i);
  if (!match) return null;
  return parseNumber(match[2], null);
};

const inferIntent = (message) => {
  const lower = message.toLowerCase();
  if (/book|reserve|reservation/i.test(lower)) return "booking";
  if (/find|show|recommend|suggest|looking for|search/i.test(lower)) return "discovery";
  return "general";
};

const isVagueMessage = (message, filters) => {
  if (message.length < 6) return true;
  const hasConcreteSignal =
    filters.cuisines.length > 0 ||
    filters.dietarySupport.length > 0 ||
    filters.priceRanges.length > 0 ||
    filters.query.length >= 3 ||
    filters.distanceRadius != null ||
    filters.partySize != null ||
    /restaurant|food|dinner|lunch|breakfast|date|brunch|cafe|café|sushi|pizza|burger/i.test(message);

  return !hasConcreteSignal;
};

const sanitizeRestaurant = (restaurant) => ({
  id: restaurant.id,
  name: restaurant.name,
  cuisine: restaurant.cuisine,
  rating: restaurant.rating,
  price_range: restaurant.price_range,
  address: restaurant.address,
  dietary_support: restaurant.dietary_support,
  distance_km: restaurant.distance_km,
  description: restaurant.description,
  opening_time: restaurant.opening_time,
  closing_time: restaurant.closing_time,
});

const buildPromptContext = ({ message, explicitFilters, inferredFilters, userContext }) => ({
  system_goal: "Recommend restaurants and guide bookings with safe, relevant, concise help.",
  user_message: message,
  explicit_filters: explicitFilters,
  inferred_filters: inferredFilters,
  user_profile: userContext
    ? {
        user_id: userContext.profile.id,
        full_name: userContext.profile.full_name,
        latitude: userContext.profile.latitude,
        longitude: userContext.profile.longitude,
        reservation_count: userContext.reservationCount,
        recent_review_count: userContext.recentReviews.length,
      }
    : null,
  instructions: [
    "Ask a clarifying question when the request is too vague.",
    "Use available filters such as cuisine, price, diet, and distance.",
    "Avoid unsafe, irrelevant, or non-restaurant guidance.",
    "Offer actionable next steps when useful.",
  ],
});

const mergeFilters = ({ message, filters = {}, userContext }) => {
  const normalizedMessage = normalizeText(message);
  const explicitCuisines = toArray(filters.cuisine || filters.cuisines);
  const explicitPrices = toArray(filters.price_range || filters.priceRange || filters.priceRanges);
  const explicitDietary = toArray(filters.dietary_support || filters.dietarySupport);

  const merged = {
    query: normalizeText(filters.query || normalizedMessage),
    cuisines: explicitCuisines.length ? explicitCuisines : detectCuisineFilters(normalizedMessage),
    priceRanges: explicitPrices.length ? explicitPrices : detectPriceFilters(normalizedMessage),
    dietarySupport: explicitDietary.length ? explicitDietary : detectDietaryFilters(normalizedMessage),
    minRating: parseNumber(filters.minRating, null),
    openNow: filters.openNow === true,
    availabilityDate: normalizeText(filters.availabilityDate || filters.date || "") || null,
    availabilityTime: normalizeText(filters.availabilityTime || filters.time || "") || null,
    distanceRadius: detectDistanceRadius(normalizedMessage, filters.distanceRadius),
    partySize: parseNumber(filters.partySize, null),
    latitude: parseNumber(filters.latitude, parseNumber(userContext?.profile?.latitude, null)),
    longitude: parseNumber(filters.longitude, parseNumber(userContext?.profile?.longitude, null)),
    sortBy: normalizeText(filters.sortBy || "rating") || "rating",
  };

  if (merged.distanceRadius != null && (merged.latitude == null || merged.longitude == null)) {
    merged.distanceRadius = null;
  }

  return merged;
};

const buildClarifyingResponse = (userName) => {
  const greeting = userName ? `${userName}, ` : "";
  return {
    message: `${greeting}I can help, but I need a bit more detail first. Tell me at least one preference such as cuisine, budget, dietary needs, distance, or whether you want booking help.`,
    restaurants: [],
    suggestions: [
      "Try: Find me Italian places under $$",
      "Try: Suggest halal restaurants near me",
      "Try: Help me book dinner for 4 tomorrow at 8 PM",
    ],
    requires_clarification: true,
    intent: "clarification",
  };
};

const buildUnsafeResponse = () => ({
  message: "I can only help with safe, relevant restaurant discovery and booking support inside DineSmart.",
  restaurants: [],
  suggestions: [
    "Ask for restaurant recommendations",
    "Ask for cuisine or dietary-based suggestions",
    "Ask for booking help for a specific date and time",
  ],
  requires_clarification: false,
  intent: "guardrail",
});

const buildNoResultsResponse = (filters) => ({
  message: "I couldn't find a strong match with the current filters. Try widening your budget, cuisine, distance, or timing filters and I’ll search again.",
  restaurants: [],
  suggestions: [
    filters.cuisines.length ? "Remove the cuisine filter" : "Add a cuisine preference",
    filters.distanceRadius != null ? "Increase the distance radius" : "Add a distance radius",
    filters.priceRanges.length ? "Try one more price range" : "Add a budget level like $$",
  ],
  requires_clarification: false,
  intent: "no_results",
});

const buildRecommendationMessage = ({ userContext, restaurants, filters, intent }) => {
  const firstName = userContext?.profile?.full_name ? userContext.profile.full_name.split(" ")[0] : "";
  const intro = firstName ? `${firstName}, here are some good matches` : "Here are some good matches";

  const filterBits = [];
  if (filters.cuisines.length) filterBits.push(filters.cuisines.join(", "));
  if (filters.dietarySupport.length) filterBits.push(filters.dietarySupport.join(", "));
  if (filters.priceRanges.length) filterBits.push(`budget ${filters.priceRanges.join("/")}`);
  if (filters.distanceRadius != null) filterBits.push(`within ${filters.distanceRadius} km`);
  const suffix = filterBits.length ? ` for ${filterBits.join(" • ")}` : "";

  const lines = restaurants.slice(0, 3).map((restaurant, index) => {
    const reasons = [restaurant.cuisine || "Cuisine not listed"];
    if (restaurant.price_range) reasons.push(restaurant.price_range);
    if (restaurant.rating != null) reasons.push(`rating ${restaurant.rating}`);
    if (restaurant.distance_km != null) reasons.push(`${restaurant.distance_km} km away`);
    return `${index + 1}. ${restaurant.name} — ${reasons.join(" • ")}`;
  });

  const action = intent === "booking"
    ? "If one looks right, I can help you move toward booking details next."
    : "You can refine the search more if you want something more specific.";

  return `${intro}${suffix}:\n${lines.join("\n")}\n${action}`;
};

const buildActionSuggestions = (intent, restaurants) => {
  const base = restaurants.slice(0, 3).map((restaurant) => `Open ${restaurant.name}`);
  if (intent === "booking") {
    return [...base, "Pick a date, time, and party size for booking"];
  }
  return [...base, "Refine by price, diet, or distance"];
};

const getChatResponse = async ({ userId, message, filters = {} }) => {
  const startedAt = Date.now();
  const safeMessage = normalizeText(message);
  const fallback = {
    message: "Sorry, something went wrong while preparing recommendations. Please try again in a moment.",
    restaurants: [],
    suggestions: ["Try again", "Change the filters", "Search with a simpler request"],
    requires_clarification: false,
    intent: "fallback",
    metadata: {
      model_provider: MODEL_PROVIDER,
      model_name: MODEL_NAME,
    },
  };

  try {
    if (!safeMessage) {
      const response = buildClarifyingResponse("");
      await chatRepository.createConversationLog({
        userId,
        userMessage: safeMessage || "",
        assistantResponse: response.message,
        latencyMs: Date.now() - startedAt,
        modelProvider: MODEL_PROVIDER,
        modelName: MODEL_NAME,
        requestContext: { reason: "empty_message" },
        responseMetadata: { intent: response.intent, restaurant_count: 0 },
      });
      return {
        ...response,
        metadata: { model_provider: MODEL_PROVIDER, model_name: MODEL_NAME },
      };
    }

    const userContext = await chatRepository.getUserContext(userId);
    const mergedFilters = mergeFilters({ message: safeMessage, filters, userContext });
    const promptContext = buildPromptContext({
      message: safeMessage,
      explicitFilters: filters,
      inferredFilters: mergedFilters,
      userContext,
    });
    const intent = inferIntent(safeMessage);

    if (includesAny(safeMessage, UNSAFE_PATTERNS)) {
      const response = buildUnsafeResponse();
      await chatRepository.createConversationLog({
        userId,
        userMessage: safeMessage,
        assistantResponse: response.message,
        latencyMs: Date.now() - startedAt,
        modelProvider: MODEL_PROVIDER,
        modelName: MODEL_NAME,
        requestContext: { ...promptContext, blocked: true },
        responseMetadata: { intent: response.intent, restaurant_count: 0 },
      });
      return {
        ...response,
        metadata: { model_provider: MODEL_PROVIDER, model_name: MODEL_NAME },
      };
    }

    if (isVagueMessage(safeMessage, mergedFilters)) {
      const response = buildClarifyingResponse(userContext?.profile?.full_name?.split(" ")[0] || "");
      await chatRepository.createConversationLog({
        userId,
        userMessage: safeMessage,
        assistantResponse: response.message,
        latencyMs: Date.now() - startedAt,
        modelProvider: MODEL_PROVIDER,
        modelName: MODEL_NAME,
        requestContext: { ...promptContext, vague: true },
        responseMetadata: { intent: response.intent, restaurant_count: 0 },
      });
      return {
        ...response,
        metadata: { model_provider: MODEL_PROVIDER, model_name: MODEL_NAME },
      };
    }

    const restaurants = await restaurantRepository.searchRestaurants(
      mergedFilters.query,
      mergedFilters.cuisines,
      {
        minRating: mergedFilters.minRating,
        priceRanges: mergedFilters.priceRanges,
        verifiedOnly: true,
        dietarySupport: mergedFilters.dietarySupport,
        openNow: mergedFilters.openNow,
        availabilityDate: mergedFilters.availabilityDate,
        availabilityTime: mergedFilters.availabilityTime,
        latitude: mergedFilters.latitude,
        longitude: mergedFilters.longitude,
        distanceRadius: mergedFilters.distanceRadius,
        sortBy: mergedFilters.sortBy,
      }
    );

    const topRestaurants = restaurants.slice(0, MAX_RESULTS).map(sanitizeRestaurant);
    const enrichedPromptContext = {
      ...promptContext,
      candidate_restaurants: topRestaurants.map((restaurant) => ({
        id: restaurant.id,
        name: restaurant.name,
        cuisine: restaurant.cuisine,
        rating: restaurant.rating,
        price_range: restaurant.price_range,
        dietary_support: restaurant.dietary_support,
        distance_km: restaurant.distance_km,
      })),
    };
    const response = topRestaurants.length
      ? {
          message: buildRecommendationMessage({
            userContext,
            restaurants: topRestaurants,
            filters: mergedFilters,
            intent,
          }),
          restaurants: topRestaurants,
          suggestions: buildActionSuggestions(intent, topRestaurants),
          requires_clarification: false,
          intent,
        }
      : buildNoResultsResponse(mergedFilters);

    await chatRepository.createConversationLog({
      userId,
      userMessage: safeMessage,
      assistantResponse: response.message,
      latencyMs: Date.now() - startedAt,
      modelProvider: MODEL_PROVIDER,
      modelName: MODEL_NAME,
      requestContext: enrichedPromptContext,
      responseMetadata: {
        intent: response.intent,
        restaurant_count: topRestaurants.length,
        restaurant_ids: topRestaurants.map((restaurant) => restaurant.id),
      },
    });

    return {
      ...response,
      metadata: {
        model_provider: MODEL_PROVIDER,
        model_name: MODEL_NAME,
      },
    };
  } catch (error) {
    try {
      await chatRepository.createConversationLog({
        userId,
        userMessage: safeMessage,
        assistantResponse: fallback.message,
        latencyMs: Date.now() - startedAt,
        modelProvider: MODEL_PROVIDER,
        modelName: MODEL_NAME,
        requestContext: { error: true, message: error.message },
        responseMetadata: { intent: fallback.intent, restaurant_count: 0 },
      });
    } catch (logError) {
      console.error("Failed to log AI fallback response:", logError.message);
    }

    return fallback;
  }
};

const getRecentConversationLogs = async (limit = 20) => {
  return chatRepository.getRecentConversationLogs(limit);
};

module.exports = {
  getChatResponse,
  getRecentConversationLogs,
};
