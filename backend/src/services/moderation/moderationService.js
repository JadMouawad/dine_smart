const db = require("../../config/db");
const moderationModel = require("../../models/moderation.model");
const perspectiveProvider = require("./providers/perspectiveProvider");
const heuristicProvider = require("./providers/heuristicProvider");
const { SOURCE_TYPES, SUGGESTED_ACTIONS, FLAG_TYPES } = require("./constants");
const { hashText, buildSnippet } = require("./normalization");
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

const clampScore = (value) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
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

const scoreToDecision = (score) => {
  if (score <= 30) return "approved";
  if (score >= 85) return "rejected";
  return "pending_review";
};

const persistSignals = async ({ reviewId, reviewUserId, signals }) => {
  for (const signal of signals) {
    await moderationModel.createFlaggedReview(db, {
      reviewId,
      userId: signal.sourceType === SOURCE_TYPES.USER_REPORT ? reviewUserId : null,
      reason: signal.reason,
      status: signal.status,
      sourceType: signal.sourceType,
      flagType: signal.flagType,
      confidence: signal.confidence,
      severity: signal.severity,
      snippet: signal.snippet,
      suggestedAction: signal.suggestedAction,
      moderationMetadata: {
        provider: signal.provider,
        labels: Array.isArray(signal.labels) ? signal.labels : [],
        decision: signal.decision,
        score: signal.score,
      },
    });
  }
};

const buildFallbackDecisionSignal = ({ overallScore, decision, reason, source }) => ({
  flagType: FLAG_TYPES.INAPPROPRIATE_CONTENT,
  confidence: overallScore,
  reason: reason || `Moderation decision ${decision} with score ${overallScore}/100.`,
  snippet: "",
  provider: source || "combined",
  sourceType: SOURCE_TYPES.SYSTEM_RULE,
  labels: ["decision_only"],
  decision,
  score: overallScore,
  severity: "MEDIUM",
  suggestedAction: SUGGESTED_ACTIONS.REQUIRES_REVIEW,
  status: "pending",
});

const moderateReviewComment = async ({ reviewId, restaurantId, reviewUserId, rating, comment, mode = "create" }) => {
  const text = String(comment || "").trim();
  if (!text) {
    return {
      flagged: false,
      score: 0,
      decision: "approved",
      status: "approved",
      labels: [],
      reason: "No review comment provided",
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
  let aiScore = 0;
  let aiReason = null;

  if (cached) {
    signals = cached.signals;
    aiScore = cached.aiScore;
    aiReason = cached.aiReason;
    source = "cache";
  } else {
    const heuristics = heuristicProvider.classify({ text, rating });
    let perspectiveSignals = [];

    const aiEnabled = policy?.ai_enabled !== false;
    if (aiEnabled) {
      const perspective = await perspectiveProvider.classify({ text });
      aiScore = clampScore(perspective?.score);
      aiReason = perspective?.reason || perspective?.error || null;
      perspectiveSignals = perspective?.signals || [];

      if (perspective?.error) {
        console.warn(`[Moderation][Perspective] reviewId=${reviewId} error=${perspective.error}`);
      }
    }

    signals = mergeSignalsByFlagType([
      ...heuristics.map((signal) => ({ ...signal, sourceType: SOURCE_TYPES.SYSTEM_RULE })),
      ...perspectiveSignals.map((signal) => ({ ...signal, sourceType: SOURCE_TYPES.SYSTEM_AI })),
    ]);

    setCached(cacheKey, {
      signals,
      aiScore,
      aiReason,
    });
  }

  const enrichedSignals = signals.map((signal) => {
    const confidence = clampScore(signal.confidence);
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

  const topSignal = [...enrichedSignals].sort((a, b) => b.confidence - a.confidence)[0] || null;
  const heuristicTopScore = clampScore(topSignal?.confidence);
  const overallScore = Math.max(aiScore, heuristicTopScore);
  const decision = scoreToDecision(overallScore);
  const status = decision === "approved" ? "approved" : "pending_review";
  const needsManualReview = decision !== "approved";

  let signalsToPersist = enrichedSignals
    .filter((signal) => signal.suggestedAction !== SUGGESTED_ACTIONS.INFORMATION_ONLY || signal.confidence >= 35)
    .map((signal) => ({
      ...signal,
      decision,
      score: overallScore,
      status: needsManualReview ? "pending" : "resolved",
      suggestedAction: needsManualReview ? SUGGESTED_ACTIONS.REQUIRES_REVIEW : signal.suggestedAction,
    }));

  if (needsManualReview && signalsToPersist.length === 0) {
    signalsToPersist = [
      buildFallbackDecisionSignal({
        overallScore,
        decision,
        reason: aiReason,
        source,
      }),
    ];
  }

  if (signalsToPersist.length > 0) {
    await persistSignals({ reviewId, reviewUserId, signals: signalsToPersist });
  }

  const labels = Array.from(
    new Set(
      enrichedSignals.flatMap((signal) => {
        const ownLabels = Array.isArray(signal.labels) ? signal.labels : [];
        return [signal.flagType, ...ownLabels].filter(Boolean);
      })
    )
  );

  const reason = topSignal?.reason || aiReason || "No moderation trigger";
  const textSnippet = buildSnippet(text, 180).replace(/\s+/g, " ");
  console.info(
    `[Moderation] reviewId=${reviewId} restaurantId=${restaurantId} score=${overallScore} decision=${decision} status=${status} source=${source} signals=${enrichedSignals.length} text="${textSnippet}"`
  );

  return {
    flagged: needsManualReview,
    score: overallScore,
    decision,
    status,
    labels,
    reason,
    suggestedAction: needsManualReview ? SUGGESTED_ACTIONS.REQUIRES_REVIEW : SUGGESTED_ACTIONS.INFORMATION_ONLY,
    signals: enrichedSignals,
    source,
  };
};

module.exports = {
  moderateReviewComment,
};
