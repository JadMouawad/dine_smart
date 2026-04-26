// src/services/restaurantService.js
const restaurantRepository = require("../repositories/restaurantRepository");

const createRestaurant = async (data) => {
  return await restaurantRepository.createRestaurant(data);
};

const getAllRestaurants = async () => {
  return await restaurantRepository.getAllRestaurants();
};

const getRestaurantById = async (id) => {
  return await restaurantRepository.getRestaurantById(id);
};

const getRestaurantByOwnerId = async (ownerId) => {
  return await restaurantRepository.getRestaurantByOwnerId(ownerId);
};

const getRestaurantByIdAndOwnerId = async (restaurantId, ownerId) => {
  return await restaurantRepository.getRestaurantByIdAndOwnerId(restaurantId, ownerId);
};

const updateRestaurant = async (id, data) => {
  return await restaurantRepository.updateRestaurant(id, data);
};

const deleteRestaurant = async (id) => {
  return await restaurantRepository.deleteRestaurant(id);
};

const searchRestaurants = async (query, cuisines, filters = {}) => {
  return await restaurantRepository.searchRestaurants(query || "", cuisines, filters);
};

const getTableConfigByRestaurantId = async (restaurantId) => {
  return await restaurantRepository.getTableConfigByRestaurantId(restaurantId);
};

const upsertTableConfigByRestaurantId = async (restaurantId, config) => {
  return await restaurantRepository.upsertTableConfigByRestaurantId(restaurantId, config);
};

const normalizeLookupName = (value = "") => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\b(restaurant|restaurants|resto|rest|cafe|café|bistro|grill|place|spot)\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const compactLookupName = (value = "") => normalizeLookupName(value).replace(/\s+/g, "");

const levenshteinDistance = (a = "", b = "") => {
  const left = String(a);
  const right = String(b);
  const dp = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[left.length][right.length];
};

const scoreRestaurantCandidate = (input, candidateName) => {
  const normalizedInput = normalizeLookupName(input);
  const compactInput = compactLookupName(input);
  const normalizedCandidate = normalizeLookupName(candidateName);
  const compactCandidate = compactLookupName(candidateName);

  if (!compactInput || !compactCandidate) return 0;
  if (compactInput === compactCandidate) return 1;
  if (compactCandidate.startsWith(compactInput) || compactInput.startsWith(compactCandidate)) return 0.96;
  if (compactCandidate.includes(compactInput) || compactInput.includes(compactCandidate)) return 0.93;

  const distance = levenshteinDistance(compactInput, compactCandidate);
  const longestLength = Math.max(compactInput.length, compactCandidate.length, 1);
  const similarity = 1 - (distance / longestLength);

  const inputWords = normalizedInput.split(/\s+/).filter(Boolean);
  const candidateWords = normalizedCandidate.split(/\s+/).filter(Boolean);
  const sharedWords = inputWords.filter((word) => candidateWords.includes(word)).length;
  const wordBoost = inputWords.length ? (sharedWords / inputWords.length) * 0.1 : 0;

  return similarity + wordBoost;
};

const chooseBestRestaurantCandidate = (input, candidates = []) => {
  const compactInput = compactLookupName(input);
  if (!compactInput || compactInput.length < 3) return null;

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreRestaurantCandidate(input, candidate.name)
    }))
    .filter((item) => item.score >= 0.62)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return (Number(right.candidate.review_count) || 0) - (Number(left.candidate.review_count) || 0);
    });

  const best = ranked[0];
  if (!best) return null;

  const runnerUp = ranked[1];
  if (runnerUp && best.score - runnerUp.score < 0.04 && best.score < 0.9) {
    return null;
  }

  return best.candidate;
};

const restaurantNameCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

const getCachedValue = (key) => {
  const cached = restaurantNameCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }
  return undefined;
};

const setCachedValue = (key, value) => {
  restaurantNameCache.set(key, {
    value,
    timestamp: Date.now()
  });
};

const findRestaurantByName = async (name) => {
  const rawKey = String(name || "").trim().toLowerCase();
  const normalizedKey = compactLookupName(name);
  const cacheKey = normalizedKey || rawKey;
  if (!cacheKey) return null;

  const cached = getCachedValue(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const restaurant = await restaurantRepository.findRestaurantByName(name);
  if (restaurant) {
    setCachedValue(cacheKey, restaurant);
    return restaurant;
  }

  const candidates = await restaurantRepository.getApprovedRestaurantLookupCandidates();
  const fuzzyRestaurant = chooseBestRestaurantCandidate(name, candidates);

  setCachedValue(cacheKey, fuzzyRestaurant || null);
  return fuzzyRestaurant || null;
};

const requestRestaurantDeletion = async ({ ownerId }) => {
  const result = await restaurantRepository.requestRestaurantDeletion(ownerId);
  if (!result) return { success: false, status: 404, error: "Restaurant not found." };
  return { success: true, status: 200, data: result };
};

const getPendingDeletionRestaurants = async () => {
  return await restaurantRepository.getPendingDeletionRestaurants();
};

const approveRestaurantDeletion = async ({ restaurantId }) => {
  const deleted = await restaurantRepository.deleteRestaurant(restaurantId);
  if (!deleted) return { success: false, status: 404, error: "Restaurant not found." };
  return { success: true, status: 200, data: deleted };
};

const rejectRestaurantDeletion = async ({ restaurantId }) => {
  const result = await restaurantRepository.cancelRestaurantDeletionRequest(restaurantId);
  if (!result) return { success: false, status: 404, error: "Restaurant not found." };
  return { success: true, status: 200, data: result };
};

module.exports = {
  createRestaurant,
  getAllRestaurants,
  getRestaurantById,
  getRestaurantByOwnerId,
  getRestaurantByIdAndOwnerId,
  updateRestaurant,
  deleteRestaurant,
  searchRestaurants,
  getTableConfigByRestaurantId,
  upsertTableConfigByRestaurantId,
  findRestaurantByName,
  requestRestaurantDeletion,
  getPendingDeletionRestaurants,
  approveRestaurantDeletion,
  rejectRestaurantDeletion,
};