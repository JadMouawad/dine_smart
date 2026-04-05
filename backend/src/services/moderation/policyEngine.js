const { DEFAULT_THRESHOLDS, SUGGESTED_ACTIONS, SEVERITY } = require("./constants");

const parseThresholdOverrides = () => {
  const raw = process.env.REVIEW_MODERATION_THRESHOLDS_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
};

const mergeThresholds = (restaurantPolicy = null) => {
  const envOverrides = parseThresholdOverrides();
  const merged = {
    ...DEFAULT_THRESHOLDS,
    ...envOverrides,
    perType: {
      ...DEFAULT_THRESHOLDS.perType,
      ...(envOverrides.perType || {}),
    },
  };

  if (restaurantPolicy && typeof restaurantPolicy === "object") {
    if (restaurantPolicy.thresholds && typeof restaurantPolicy.thresholds === "object") {
      if (Number.isFinite(restaurantPolicy.thresholds.HIGH)) merged.HIGH = restaurantPolicy.thresholds.HIGH;
      if (Number.isFinite(restaurantPolicy.thresholds.MEDIUM)) merged.MEDIUM = restaurantPolicy.thresholds.MEDIUM;
    }

    if (restaurantPolicy.perType && typeof restaurantPolicy.perType === "object") {
      Object.keys(restaurantPolicy.perType).forEach((type) => {
        merged.perType[type] = {
          ...(merged.perType[type] || {}),
          ...restaurantPolicy.perType[type],
        };
      });
    }
  }

  return merged;
};

const confidenceToSeverity = (confidence, thresholds) => {
  if (confidence >= thresholds.HIGH) return SEVERITY.HIGH;
  if (confidence >= thresholds.MEDIUM) return SEVERITY.MEDIUM;
  return SEVERITY.LOW;
};

const suggestAction = ({ flagType, confidence, thresholds }) => {
  const typeThreshold = thresholds.perType[flagType] || { review: 85, soft: 50 };
  if (confidence >= typeThreshold.review) return SUGGESTED_ACTIONS.REQUIRES_REVIEW;
  if (confidence >= typeThreshold.soft) return SUGGESTED_ACTIONS.SOFT_FLAG;
  return SUGGESTED_ACTIONS.INFORMATION_ONLY;
};

module.exports = {
  mergeThresholds,
  confidenceToSeverity,
  suggestAction,
};
