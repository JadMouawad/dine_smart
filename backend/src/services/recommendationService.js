const crypto = require("crypto");
const OpenAI = require("openai");
const recommendationRepository = require("../repositories/recommendationRepository");
const profileRepository = require("../repositories/profileRepository");

const CACHE_TTL_MS = Number(process.env.RECOMMENDATION_CACHE_TTL_MS || 10 * 60 * 1000);
const OPENAI_MODEL = process.env.RECOMMENDATION_OPENAI_MODEL || "gpt-4o-mini";
const GITHUB_MODEL = process.env.RECOMMENDATION_GITHUB_MODEL || "openai/gpt-4o-mini";
const GITHUB_ENDPOINT = process.env.GITHUB_MODELS_ENDPOINT || "https://models.github.ai/inference";
const MAX_CANDIDATES = Number(process.env.RECOMMENDATION_MAX_CANDIDATES || 24);

const inMemoryCache = new Map();

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: Number(process.env.RECOMMENDATION_AI_TIMEOUT_MS || 1800),
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

  return {
    preferredCuisines: takeTopKeys(cuisineWeights, 4),
    preferredPriceRanges: takeTopKeys(priceWeights, 3),
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

const buildFallbackRecommendations = ({ candidates, preferenceProfile, limit, source = "fallback" }) => {
  const cuisineSet = new Set(preferenceProfile.preferredCuisines);
  const priceSet = new Set(preferenceProfile.preferredPriceRanges);

  const ranked = candidates
    .map((candidate) => {
      const rating = Number(candidate.rating || 0);
      const matchCuisine = cuisineSet.has(candidate.cuisine);
      const matchPrice = priceSet.has(candidate.price_range);
      const popularity = Number(candidate.recent_reservations || 0);
      const score = rating * 10 + (matchCuisine ? 18 : 0) + (matchPrice ? 10 : 0) + Math.min(popularity, 15);

      const reasonParts = [];
      if (matchCuisine) reasonParts.push(`matches your ${candidate.cuisine} preference`);
      if (matchPrice) reasonParts.push(`fits your usual ${candidate.price_range} budget`);
      if (rating >= 4) reasonParts.push(`has a strong rating (${rating.toFixed(1)})`);
      if (!reasonParts.length) reasonParts.push("is trending among diners right now");

      return {
        ...candidate,
        recommendationScore: Math.round(score),
        reason: `Recommended because it ${reasonParts.join(" and ")}.`,
      };
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, limit)
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      cuisine: candidate.cuisine,
      rating: candidate.rating,
      price_range: candidate.price_range,
      address: candidate.address,
      distance_km: candidate.distance_km,
      description: candidate.description || `${candidate.cuisine || "Popular"} restaurant with consistent diner demand.`,
      reason: candidate.reason,
      source,
    }));

  return ranked;
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

  return `
You are generating personalized restaurant recommendations.

Rules:
- Use ONLY candidate IDs provided below.
- Never invent restaurants.
- Return JSON only.
- Choose up to ${limit} recommendations.

User profile:
${JSON.stringify(preferenceProfile, null, 2)}

Candidates:
${JSON.stringify(compactCandidates, null, 2)}

Return shape:
{
  "recommendations": [
    {
      "restaurantId": 123,
      "reason": "short reason tied to user history",
      "description": "one sentence summary"
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
      id: candidate.id,
      name: candidate.name,
      cuisine: candidate.cuisine,
      rating: candidate.rating,
      price_range: candidate.price_range,
      address: candidate.address,
      distance_km: candidate.distance_km,
      description:
        String(entry?.description || "").trim() ||
        candidate.description ||
        `${candidate.cuisine || "Popular"} restaurant worth trying.`,
      reason:
        String(entry?.reason || "").trim() ||
        `Recommended based on your dining history and similar preferences.`,
      source: "ai",
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
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.RECOMMENDATION_GITHUB_TIMEOUT_MS || 1600)
  );

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
  }).finally(() => {
    clearTimeout(timeout);
  });

  if (!response.ok) {
    throw new Error(`GitHub models recommendation call failed (${response.status})`);
  }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "";
};

const runAiRecommendationSelection = async ({ preferenceProfile, candidates, limit }) => {
  if (!candidates.length) return { recommendations: [], provider: "none" };

  const prompt = buildAiPrompt({ preferenceProfile, candidates, limit });
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  try {
    const raw = await runOpenAiSelection({ prompt });
    const parsed = safeJsonParse(raw);
    const recommendations = normalizeAiRecommendations({ parsed, candidatesById, limit });
    if (recommendations.length > 0) {
      return { recommendations, provider: "openai" };
    }
  } catch (error) {
    console.warn(`[Recommendations] OpenAI ranking failed: ${error.message}`);
  }

  try {
    const raw = await runGithubSelection({ prompt });
    const parsed = safeJsonParse(raw);
    const recommendations = normalizeAiRecommendations({ parsed, candidatesById, limit });
    if (recommendations.length > 0) {
      return { recommendations, provider: "github-models" };
    }
  } catch (error) {
    console.warn(`[Recommendations] GitHub ranking failed: ${error.message}`);
  }

  return { recommendations: [], provider: "none" };
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

  const aiSelection = await runAiRecommendationSelection({
    preferenceProfile,
    candidates,
    limit: safeLimit,
  });

  const recommendations =
    aiSelection.recommendations.length > 0
      ? aiSelection.recommendations
      : buildFallbackRecommendations({
          candidates,
          preferenceProfile,
          limit: safeLimit,
          source: "fallback",
        });

  const responsePayload = {
    recommendations,
    source: aiSelection.recommendations.length > 0 ? aiSelection.provider : "fallback",
    cached: false,
    profile: {
      preferred_cuisines: preferenceProfile.preferredCuisines,
      preferred_price_ranges: preferenceProfile.preferredPriceRanges,
      common_reservation_hours: preferenceProfile.commonReservationHours,
      history_signals: preferenceProfile.historySignals,
    },
  };

  setCache(cacheKey, {
    fingerprint,
    payload: responsePayload,
  });

  console.info(
    `[Recommendations] userId=${userId} source=${responsePayload.source} candidates=${candidates.length} returned=${recommendations.length} historySignals=${preferenceProfile.historySignals}`
  );

  return responsePayload;
};

module.exports = {
  getRecommendations,
};
