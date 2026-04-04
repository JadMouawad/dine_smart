const db = require("../../config/db");
const moderationModel = require("../../models/moderation.model");
const perspectiveProvider = require("./providers/perspectiveProvider");
const heuristicProvider = require("./providers/heuristicProvider");
const { SOURCE_TYPES, SUGGESTED_ACTIONS } = require("./constants");
const { hashText } = require("./normalization");
const { mergeThresholds, confidenceToSeverity, suggestAction } = require("./policyEngine");

const CACHE_TTL_MS = Number(process.env.MODERATION_CACHE_TTL_MS || 120000);
const inMemoryCache = new Map();

const getCached = (cacheKey) => {
  const hit = inMemoryCache.get(cacheKey);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    inMemoryCache.delete(cacheKey);
    return null;
  }
  return hit.value;
};

const setCached = (cacheKey, value) => {
  inMemoryCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

const mergeSignalsByFlagType = (signals) => {
  const merged = new Map();
  signals.forEach((signal) => {
    if (!signal?.flagType) return;
    const existing = merged.get(signal.flagType);
    if (!existing || existing.confidence < signal.confidence) {
      merged.set(signal.flagType, signal);
    }
  });
  return Array.from(merged.values());
};

const persistSignals = async ({ reviewId, reviewUserId, signals }) => {
  for (const signal of signals) {
    await moderationModel.createFlaggedReview(db, {
      reviewId,
      userId: signal.sourceType === SOURCE_TYPES.USER_REPORT ? reviewUserId : null,
      reason: signal.reason,
      status: signal.suggestedAction === SUGGESTED_ACTIONS.REQUIRES_REVIEW ? "pending" : "resolved",
      sourceType: signal.sourceType,
      flagType: signal.flagType,
      confidence: signal.confidence,
      severity: signal.severity,
      snippet: signal.snippet,
      suggestedAction: signal.suggestedAction,
      moderationMetadata: {
        provider: signal.provider,
      },
    });
  }
};

const moderateReviewComment = async ({ reviewId, restaurantId, reviewUserId, rating, comment, mode = "create" }) => {
  const text = String(comment || "").trim();
  if (!text) {
    return {
      flagged: false,
      suggestedAction: SUGGESTED_ACTIONS.INFORMATION_ONLY,
      signals: [],
      source: "none",
    };
  }

  if (mode === "update") {
    await moderationModel.resolvePendingSystemFlagsForReview(
      db,
      reviewId,
      "System re-check triggered after review update"
    );
  }

  const policy = await moderationModel.getRestaurantModerationPolicy(db, restaurantId);
  const policyJson = policy?.policy_json && typeof policy.policy_json === "object" ? policy.policy_json : null;
  const thresholds = mergeThresholds(policyJson);

  const cacheKey = `${restaurantId}:${rating}:${hashText(text)}`;
  const cached = getCached(cacheKey);

  let signals;
  let source = "combined";

  if (cached) {
    signals = cached;
    source = "cache";
  } else {
    const heuristics = heuristicProvider.classify({ text, rating });
    let perspectiveSignals = [];

    const aiEnabled = policy?.ai_enabled !== false;
    if (aiEnabled) {
      try {
        const perspective = await perspectiveProvider.classify({ text });
        perspectiveSignals = perspective.signals || [];
      } catch (_error) {
        perspectiveSignals = [];
      }
    }

    signals = mergeSignalsByFlagType([
      ...heuristics.map((signal) => ({ ...signal, sourceType: SOURCE_TYPES.SYSTEM_RULE })),
      ...perspectiveSignals.map((signal) => ({ ...signal, sourceType: SOURCE_TYPES.SYSTEM_AI })),
    ]);

    setCached(cacheKey, signals);
  }

  const enrichedSignals = signals.map((signal) => {
    const confidence = Math.max(0, Math.min(100, Number(signal.confidence || 0)));
    return {
      ...signal,
      confidence,
      severity: confidenceToSeverity(confidence, thresholds),
      suggestedAction: suggestAction({
        flagType: signal.flagType,
        confidence,
        thresholds,
      }),
    };
  });

  await persistSignals({ reviewId, reviewUserId, signals: enrichedSignals });

  const requiresReviewSignals = enrichedSignals.filter(
    (signal) => signal.suggestedAction === SUGGESTED_ACTIONS.REQUIRES_REVIEW
  );

  const topSignal = enrichedSignals.sort((a, b) => b.confidence - a.confidence)[0] || null;

  return {
    flagged: requiresReviewSignals.length > 0,
    suggestedAction: requiresReviewSignals.length > 0
      ? SUGGESTED_ACTIONS.REQUIRES_REVIEW
      : topSignal?.suggestedAction || SUGGESTED_ACTIONS.INFORMATION_ONLY,
    signals: enrichedSignals,
    source,
  };
};

module.exports = {
  moderateReviewComment,
};
