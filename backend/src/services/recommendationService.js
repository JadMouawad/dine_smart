const crypto = require("crypto");
const OpenAI = require("openai");
const recommendationRepository = require("../repositories/recommendationRepository");
const profileRepository = require("../repositories/profileRepository");

const CACHE_TTL_MS = Number(process.env.RECOMMENDATION_CACHE_TTL_MS || 10 * 60 * 1000);
const OPENAI_MODEL = process.env.RECOMMENDATION_OPENAI_MODEL || "gpt-4o-mini";
const GITHUB_MODEL = process.env.RECOMMENDATION_GITHUB_MODEL || "openai/gpt-4o-mini";
const GITHUB_ENDPOINT = process.env.GITHUB_MODELS_ENDPOINT || "https://models.github.ai/inference";
const MAX_CANDIDATES = Number(process.env.RECOMMENDATION_MAX_CANDIDATES || 24);
const GITHUB_TIMEOUT_MS = Number(process.env.RECOMMENDATION_GITHUB_TIMEOUT_MS || 2600);

const inMemoryCache = new Map();

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: Number(process.env.RECOMMENDATION_AI_TIMEOUT_MS || 2000),
    })
  : null;

const clampLimit = (value, fallback = 6) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), 12);
};

const parseNullableNumber = (value) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hashValue = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");

const getCache = (key) => {
  const hit = inMemoryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    inMemoryCache.delete(key);
    return null;
  }
  return hit.value;
};

const setCache = (key, value) => {
  inMemoryCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

const safeJsonParse = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    const match = String(raw).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (_error2) {
      return null;
    }
  }
};

const takeTopKeys = (map, limit) =>
  Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);

const clamp = (value, min = 0, max = 1) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
};

const inferPreferenceProfile = ({ reviews, favorites, reservations }) => {
  const cuisineWeights = new Map();
  const priceWeights = new Map();
  const reservationHourWeights = new Map();

  const addWeight = (map, key, amount) => {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + amount);
  };

  reviews.forEach((review) => {
    const rating = Number(review.rating || 0);
    const weight = rating >= 4 ? 3 : rating <= 2 ? 1 : 2;
    addWeight(cuisineWeights, review.cuisine, weight);
    addWeight(priceWeights, review.price_range, weight);
  });

  favorites.forEach((favorite) => {
    addWeight(cuisineWeights, favorite.cuisine, 4);
    addWeight(priceWeights, favorite.price_range, 3);
  });

  reservations.forEach((reservation) => {
    const status = String(reservation.status || "").toLowerCase();
    const weight = status === "cancelled" ? 1 : 3;
    addWeight(cuisineWeights, reservation.cuisine, weight);
    addWeight(priceWeights, reservation.price_range, weight);
    const hour = String(reservation.reservation_time || "").slice(0, 2);
    if (/^\d{2}$/.test(hour)) addWeight(reservationHourWeights, hour, 1);
  });

  const filteredCuisines = Array.from(cuisineWeights.entries())
    .filter(([, weight]) => weight > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([key]) => key);

  const filteredPrices = Array.from(priceWeights.entries())
    .filter(([, weight]) => weight > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);

  return {
    preferredCuisines: filteredCuisines,
    preferredPriceRanges: filteredPrices,
    commonReservationHours: takeTopKeys(reservationHourWeights, 3),
    historySignals: reviews.length + favorites.length + reservations.length,
  };
};

const buildHistoryFingerprint = ({ reviews, favorites, reservations, latitude, longitude, limit }) =>
  hashValue(
    JSON.stringify({
      latitude,
      longitude,
      limit,
      reviews: reviews.slice(0, 20).map((row) => [row.restaurant_id, row.rating, row.created_at]),
      favorites: favorites.slice(0, 20).map((row) => [row.restaurant_id, row.created_at]),
      reservations: reservations.slice(0, 25).map((row) => [row.restaurant_id, row.status, row.created_at]),
    })
  );

const buildHistoryInsights = ({ reviews, favorites, reservations }) => {
  const cuisineAffinity = new Map();
  const priceAffinity = new Map();

  const addAffinity = (map, key, amount) => {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + amount);
  };

  reviews.forEach((review) => {
    const rating = Number(review.rating || 0);
    const isPositive = rating >= 4;
    const isNegative = rating <= 2;
    const amount = isPositive ? 4 : (isNegative ? -2 : 1);
    addAffinity(cuisineAffinity, review.cuisine, amount);
    addAffinity(priceAffinity, review.price_range, amount);
  });

  favorites.forEach((favorite) => {
    addAffinity(cuisineAffinity, favorite.cuisine, 5);
    addAffinity(priceAffinity, favorite.price_range, 4);
  });

  reservations.forEach((reservation) => {
    const status = String(reservation.status || "").toLowerCase();
    const amount = status === "cancelled" ? -1 : 2;
    addAffinity(cuisineAffinity, reservation.cuisine, amount);
    addAffinity(priceAffinity, reservation.price_range, amount);
  });

  const topCuisineWeight = Math.max(1, ...Array.from(cuisineAffinity.values()).map((value) => Math.max(value, 0)));
  const topPriceWeight = Math.max(1, ...Array.from(priceAffinity.values()).map((value) => Math.max(value, 0)));

  return {
    cuisineAffinity,
    priceAffinity,
    topCuisineWeight,
    topPriceWeight,
  };
};

const normalizeAffinity = (map, key, maxWeight) => {
  if (!key || !map.has(key) || maxWeight <= 0) return 0;
  const value = Number(map.get(key) || 0);
  if (value <= 0) return 0;
  return clamp(value / maxWeight, 0, 1);
};

const serializeRecommendation = (candidate, reason, source, recommendationScore) => ({
  id: candidate.id,
  name: candidate.name,
  cuisine: candidate.cuisine,
  rating: candidate.rating,
  price_range: candidate.price_range,
  address: candidate.address,
  distance_km: candidate.distance_km,
  description: candidate.description || `${candidate.cuisine || "Popular"} restaurant with consistent diner demand.`,
  reason,
  source,
  recommendationScore,
});

const buildDeterministicRecommendations = ({
  candidates,
  preferenceProfile,
  historyInsights,
  limit,
  source = "deterministic",
}) => {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  const cuisineSet = new Set(preferenceProfile.preferredCuisines);
  const priceSet = new Set(preferenceProfile.preferredPriceRanges);

  const maxPopularity = Math.max(1, ...candidates.map((candidate) => Number(candidate.recent_reservations || 0)));
  const distanceValues = candidates
    .map((candidate) => parseNullableNumber(candidate.distance_km))
    .filter((value) => value != null && value >= 0);
  const maxDistance = distanceValues.length > 0 ? Math.max(...distanceValues, 1) : null;

  const historyStrength = clamp((Number(preferenceProfile.historySignals || 0) - 3) / 20, 0, 1);

  return candidates
    .map((candidate) => {
      const rating = Number(candidate.rating || 0);
      const popularity = Number(candidate.recent_reservations || 0);
      const distanceKm = parseNullableNumber(candidate.distance_km);

      const ratingNormalized = clamp(rating / 5, 0, 1);
      const popularityNormalized = clamp(popularity / maxPopularity, 0, 1);
      const distanceNormalized = distanceKm == null || maxDistance == null
        ? 0.5
        : 1 - clamp(distanceKm / Math.max(maxDistance, 10), 0, 1);

      const cuisineAffinity = Math.max(
        cuisineSet.has(candidate.cuisine) ? 1 : 0,
        normalizeAffinity(historyInsights.cuisineAffinity, candidate.cuisine, historyInsights.topCuisineWeight)
      );
      const priceAffinity = Math.max(
        priceSet.has(candidate.price_range) ? 1 : 0,
        normalizeAffinity(historyInsights.priceAffinity, candidate.price_range, historyInsights.topPriceWeight)
      );

      const personalizationWeight = source === "popular-deterministic"
        ? 0.15 + historyStrength * 0.12
        : 0.26 + historyStrength * 0.18;

      const qualityComponent = ratingNormalized * 39;
      const popularityComponent = popularityNormalized * 23;
      const distanceComponent = distanceNormalized * 16;
      const preferenceComponent = (cuisineAffinity * 0.65 + priceAffinity * 0.35) * (personalizationWeight * 40);
      const score = qualityComponent + popularityComponent + distanceComponent + preferenceComponent;

      const reasonParts = [];
      if (cuisineAffinity >= 0.7 && candidate.cuisine) {
        reasonParts.push(`matches your ${candidate.cuisine} preference`);
      }
      if (priceAffinity >= 0.7 && candidate.price_range) {
        reasonParts.push(`fits your usual ${candidate.price_range} budget`);
      }
      if (rating >= 4) {
        reasonParts.push(`has strong ratings (${rating.toFixed(1)})`);
      }
      if (popularityNormalized >= 0.6) {
        reasonParts.push("is popular with diners");
      }
      if (distanceKm != null && distanceKm <= 5) {
        reasonParts.push("is nearby");
      }

      const reason = reasonParts.length > 0
        ? `Recommended because it ${reasonParts.join(" and ")}.`
        : "Recommended based on quality, popularity, and distance.";

      return serializeRecommendation(candidate, reason, source, Math.round(score));
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, limit);
};

const buildAiPrompt = ({ preferenceProfile, candidates, limit }) => {
  const compactCandidates = candidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    cuisine: candidate.cuisine,
    rating: candidate.rating,
    priceRange: candidate.price_range,
    distanceKm: candidate.distance_km,
    recentReservations: candidate.recent_reservations,
    description: candidate.description,
  }));

  const preferredCuisinesStr = preferenceProfile.preferredCuisines.length > 0
    ? preferenceProfile.preferredCuisines.join(", ")
    : "no specific cuisine preference";

  const preferredPricesStr = preferenceProfile.preferredPriceRanges.length > 0
    ? preferenceProfile.preferredPriceRanges.join(", ")
    : "no specific price range preference";

  return `
You are a restaurant recommendation engine. Your task is to select the BEST restaurants for a user based on their dining history and preferences.

CRITICAL RULES:
1. Return ONLY valid JSON. No markdown, no explanation.
2. Choose ONLY from the candidate restaurant IDs provided. NEVER invent IDs.
3. Return at most ${limit} unique recommendations.
4. PRIORITIZE restaurants matching user preferences (cuisines: ${preferredCuisinesStr}).
5. If user has cuisine preferences, recommend primarily from those cuisines UNLESS they have very few candidates.
6. Consider restaurant rating, popularity, and distance when provided.
7. Create reasons that directly reference the user's preferences or history patterns.

User Preference Profile:
- Preferred Cuisines: ${preferredCuisinesStr}
- Preferred Price Ranges: ${preferredPricesStr}
- Total Dining History Signals: ${preferenceProfile.historySignals}

Available Restaurant Candidates:
${JSON.stringify(compactCandidates, null, 2)}

REQUIRED OUTPUT FORMAT (valid JSON only):
{
  "recommendations": [
    {
      "restaurantId": <exact integer from candidates>,
      "reason": "<reason tied to user preferences>",
      "description": "<one sentence describing why this matches their taste>"
    }
  ]
}
  `.trim();
};

const normalizeAiRecommendations = ({ parsed, candidatesById, limit }) => {
  const list = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
  const deduped = [];
  const seen = new Set();

  for (const entry of list) {
    const candidateId = Number(entry?.restaurantId);
    if (!Number.isFinite(candidateId) || seen.has(candidateId)) continue;
    const candidate = candidatesById.get(candidateId);
    if (!candidate) continue;

    seen.add(candidateId);
    deduped.push({
      ...serializeRecommendation(
        candidate,
        String(entry?.reason || "").trim() || "Recommended based on your dining history and similar preferences.",
        "ai",
        null
      ),
      description:
        String(entry?.description || "").trim() ||
        candidate.description ||
        `${candidate.cuisine || "Popular"} restaurant worth trying.`,
    });

    if (deduped.length >= limit) break;
  }

  return deduped;
};

const runOpenAiSelection = async ({ prompt }) => {
  if (!openaiClient) return null;

  const response = await openaiClient.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You output strict JSON for recommendation ranking.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return response?.choices?.[0]?.message?.content || "";
};

const runGithubSelection = async ({ prompt }) => {
  const githubToken = String(process.env.GITHUB_TOKEN || "").trim();
  if (!githubToken) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, GITHUB_TIMEOUT_MS);

  try {
    const response = await fetch(`${GITHUB_ENDPOINT}/chat/completions`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GITHUB_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You output strict JSON for recommendation ranking.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = new Error(`GitHub models recommendation call failed (${response.status})`);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeProviderError = ({ provider, error }) => {
  const status = Number(error?.status || error?.statusCode || error?.response?.status);
  const normalizedStatus = Number.isFinite(status) ? status : null;
  const message = String(error?.message || "Provider error");
  const lowerMessage = message.toLowerCase();
  const name = String(error?.name || "").toLowerCase();

  let code = "provider_error";
  let level = "warn";

  if (normalizedStatus === 429 || lowerMessage.includes("quota")) {
    code = "quota_exceeded";
  } else if (name === "aborterror" || lowerMessage.includes("aborted") || lowerMessage.includes("timeout")) {
    code = "timeout";
    level = "info";
  } else if (normalizedStatus != null && normalizedStatus >= 500) {
    code = "provider_unavailable";
  } else if (normalizedStatus === 401 || normalizedStatus === 403) {
    code = "auth_error";
  }

  return {
    provider,
    code,
    status: normalizedStatus,
    message,
    level,
  };
};

const logProviderFailure = (failure) => {
  const base = `[Recommendations] ${failure.provider} ranking unavailable (${failure.code}` +
    `${failure.status != null ? `, status=${failure.status}` : ""}).`;

  if (failure.level === "info") {
    console.info(base);
    return;
  }
  console.warn(base);
};

const runAiRecommendationSelection = async ({ preferenceProfile, candidates, limit }) => {
  if (!candidates.length) {
    return {
      recommendations: [],
      provider: "none",
      attempted: false,
      providersAttempted: [],
      failures: [],
    };
  }

  const prompt = buildAiPrompt({ preferenceProfile, candidates, limit });
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  const providers = [
    { name: "openai", enabled: Boolean(openaiClient), runner: runOpenAiSelection },
    {
      name: "github-models",
      enabled: Boolean(String(process.env.GITHUB_TOKEN || "").trim()),
      runner: runGithubSelection,
    },
  ];

  const providersAttempted = [];
  const failures = [];

  for (const provider of providers) {
    if (!provider.enabled) continue;

    providersAttempted.push(provider.name);

    try {
      const raw = await provider.runner({ prompt });
      if (!raw) {
        failures.push({ provider: provider.name, code: "empty_response", status: null, message: "No content returned", level: "warn" });
        continue;
      }

      const parsed = safeJsonParse(raw);
      const recommendations = normalizeAiRecommendations({ parsed, candidatesById, limit });
      if (recommendations.length > 0) {
        return {
          recommendations,
          provider: provider.name,
          attempted: providersAttempted.length > 0,
          providersAttempted,
          failures,
        };
      }

      failures.push({
        provider: provider.name,
        code: parsed ? "empty_recommendations" : "invalid_json",
        status: null,
        message: parsed ? "No valid recommendations" : "Invalid JSON response",
        level: "warn",
      });
    } catch (error) {
      const normalized = normalizeProviderError({ provider: provider.name, error });
      failures.push(normalized);
      logProviderFailure(normalized);
    }
  }

  failures
    .filter((failure) => failure.code === "empty_response" || failure.code === "invalid_json" || failure.code === "empty_recommendations")
    .forEach((failure) => {
      const message = `[Recommendations] ${failure.provider} ranking unavailable (${failure.code}).`;
      if (failure.level === "info") console.info(message);
      else console.warn(message);
    });

  return {
    recommendations: [],
    provider: "none",
    attempted: providersAttempted.length > 0,
    providersAttempted,
    failures,
  };
};

const getEffectiveCoordinates = async ({ userId, latitude, longitude }) => {
  let resolvedLat = parseNullableNumber(latitude);
  let resolvedLng = parseNullableNumber(longitude);
  if (resolvedLat != null && resolvedLng != null) {
    return { latitude: resolvedLat, longitude: resolvedLng };
  }

  try {
    const profile = await profileRepository.getById(userId);
    const profileLat = parseNullableNumber(profile?.latitude);
    const profileLng = parseNullableNumber(profile?.longitude);
    resolvedLat = profileLat;
    resolvedLng = profileLng;
  } catch (_error) {
    resolvedLat = null;
    resolvedLng = null;
  }

  return { latitude: resolvedLat, longitude: resolvedLng };
};

const isHistoryStrong = (historySignals) => {
  return historySignals >= 5;
};

const hasPreferenceSignal = (preferenceProfile) => {
  return preferenceProfile.preferredCuisines.length > 0 || preferenceProfile.preferredPriceRanges.length > 0;
};

const getRecommendations = async ({ userId, limit = 6, latitude = null, longitude = null }) => {
  const safeLimit = clampLimit(limit, 6);
  const coords = await getEffectiveCoordinates({ userId, latitude, longitude });

  const [reviews, favorites, reservations] = await Promise.all([
    recommendationRepository.getUserReviewHistory(userId, 40),
    recommendationRepository.getUserFavoriteHistory(userId, 40),
    recommendationRepository.getUserReservationHistory(userId, 60),
  ]);

  const fingerprint = buildHistoryFingerprint({
    reviews,
    favorites,
    reservations,
    latitude: coords.latitude,
    longitude: coords.longitude,
    limit: safeLimit,
  });

  const cacheKey = `${userId}:${safeLimit}:${coords.latitude ?? "na"}:${coords.longitude ?? "na"}`;
  const cached = getCache(cacheKey);
  if (cached && cached.fingerprint === fingerprint) {
    return { ...cached.payload, cached: true };
  }

  const preferenceProfile = inferPreferenceProfile({ reviews, favorites, reservations });
  const historyInsights = buildHistoryInsights({ reviews, favorites, reservations });
  const historyRestaurantIds = Array.from(
    new Set([
      ...reviews.map((row) => Number(row.restaurant_id)).filter(Number.isFinite),
      ...favorites.map((row) => Number(row.restaurant_id)).filter(Number.isFinite),
      ...reservations.map((row) => Number(row.restaurant_id)).filter(Number.isFinite),
    ])
  );

  let candidates = await recommendationRepository.getRecommendationCandidates({
    cuisines: preferenceProfile.preferredCuisines,
    priceRanges: preferenceProfile.preferredPriceRanges,
    excludeRestaurantIds: historyRestaurantIds,
    latitude: coords.latitude,
    longitude: coords.longitude,
    limit: Math.max(safeLimit * 3, MAX_CANDIDATES),
  });

  if (candidates.length < safeLimit) {
    const supplemental = await recommendationRepository.getRecommendationCandidates({
      cuisines: [],
      priceRanges: [],
      excludeRestaurantIds: historyRestaurantIds,
      latitude: coords.latitude,
      longitude: coords.longitude,
      limit: Math.max(safeLimit * 3, MAX_CANDIDATES),
    });
    const seen = new Set(candidates.map((row) => row.id));
    supplemental.forEach((row) => {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        candidates.push(row);
      }
    });
  }

  if (candidates.length === 0) {
    candidates = await recommendationRepository.getPopularFallback({
      excludeRestaurantIds: [],
      latitude: coords.latitude,
      longitude: coords.longitude,
      limit: Math.max(safeLimit * 2, 12),
    });
  }

  const shouldUseAiRanking = isHistoryStrong(preferenceProfile.historySignals) && hasPreferenceSignal(preferenceProfile);
  const fallbackSource = shouldUseAiRanking ? "deterministic" : "popular-deterministic";

  const deterministicRecommendations = buildDeterministicRecommendations({
    candidates,
    preferenceProfile,
    historyInsights,
    limit: safeLimit,
    source: fallbackSource,
  });

  let aiSelection = {
    recommendations: [],
    provider: "none",
    attempted: false,
    providersAttempted: [],
    failures: [],
    skippedReason: shouldUseAiRanking ? null : "insufficient_signals",
  };

  if (shouldUseAiRanking && candidates.length > 0) {
    aiSelection = {
      ...(await runAiRecommendationSelection({
        preferenceProfile,
        candidates,
        limit: safeLimit,
      })),
      skippedReason: null,
    };
  }

  const aiSucceeded = aiSelection.recommendations.length > 0;
  const recommendations = aiSucceeded ? aiSelection.recommendations : deterministicRecommendations;

  const responsePayload = {
    recommendations,
    source: aiSucceeded ? aiSelection.provider : fallbackSource,
    cached: false,
    profile: {
      preferred_cuisines: preferenceProfile.preferredCuisines,
      preferred_price_ranges: preferenceProfile.preferredPriceRanges,
      common_reservation_hours: preferenceProfile.commonReservationHours,
      history_signals: preferenceProfile.historySignals,
      ai_ranking_used: shouldUseAiRanking,
    },
    ai: {
      attempted: aiSelection.attempted,
      succeeded: aiSucceeded,
      provider: aiSucceeded ? aiSelection.provider : "none",
      fallback_used: !aiSucceeded,
      providers_attempted: aiSelection.providersAttempted,
      skipped_reason: aiSelection.skippedReason,
      failures: aiSelection.failures.map((failure) => ({
        provider: failure.provider,
        code: failure.code,
        status: failure.status,
        message: failure.message,
      })),
    },
  };

  setCache(cacheKey, {
    fingerprint,
    payload: responsePayload,
  });

  const failuresSummary = responsePayload.ai.failures.length > 0
    ? responsePayload.ai.failures
        .map((failure) => `${failure.provider}:${failure.code}${failure.status != null ? `(${failure.status})` : ""}`)
        .join("|")
    : "none";

  console.info(
    `[Recommendations] userId=${userId} source=${responsePayload.source} ` +
    `candidates=${candidates.length} returned=${recommendations.length} ` +
    `aiAttempted=${responsePayload.ai.attempted} aiSucceeded=${responsePayload.ai.succeeded} ` +
    `fallbackUsed=${responsePayload.ai.fallback_used} providers=${responsePayload.ai.providers_attempted.join(",") || "none"} ` +
    `failures=${failuresSummary} historySignals=${preferenceProfile.historySignals} ` +
    `preferredCuisines=${preferenceProfile.preferredCuisines.join(",") || "none"}`
  );

  return responsePayload;
};

module.exports = {
  getRecommendations,
};
