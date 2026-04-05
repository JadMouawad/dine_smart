const https = require("https");
const { FLAG_TYPES } = require("../constants");
const { toPercentScore, buildSnippet } = require("../normalization");

const API_HOST = "commentanalyzer.googleapis.com";
const API_PATH = "/v1alpha1/comments:analyze";
const REQUEST_TIMEOUT_MS = Number(process.env.PERSPECTIVE_TIMEOUT_MS || 3000);

const ATTRIBUTE_MAP = {
  TOXICITY: FLAG_TYPES.INAPPROPRIATE_CONTENT,
  SEVERE_TOXICITY: FLAG_TYPES.INAPPROPRIATE_CONTENT,
  PROFANITY: FLAG_TYPES.PROFANITY,
  INSULT: FLAG_TYPES.HARASSMENT,
  THREAT: FLAG_TYPES.HARASSMENT,
  IDENTITY_ATTACK: FLAG_TYPES.HARASSMENT,
  SPAM: FLAG_TYPES.SPAM,
};

const buildRequestBody = (text) => ({
  comment: { text },
  languages: [process.env.MODERATION_LANGUAGE || "en"],
  requestedAttributes: Object.keys(ATTRIBUTE_MAP).reduce((acc, key) => {
    acc[key] = {};
    return acc;
  }, {}),
  doNotStore: true,
});

const analyzePerspective = ({ text, apiKey }) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(buildRequestBody(text));

    const req = https.request(
      {
        host: API_HOST,
        path: `${API_PATH}?key=${encodeURIComponent(apiKey)}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Perspective API error (${res.statusCode})`));
          }

          try {
            const parsed = JSON.parse(data || "{}");
            if (parsed?.error) {
              return reject(new Error(parsed.error.message || "Perspective API rejected request"));
            }
            return resolve(parsed);
          } catch (_error) {
            return reject(new Error("Invalid Perspective API response"));
          }
        });
      }
    );

    req.on("timeout", () => req.destroy(new Error("Perspective API timeout")));
    req.on("error", (error) => reject(error));
    req.write(body);
    req.end();
  });

const convertResponseToSignals = ({ text, response }) => {
  const attributeScores = response?.attributeScores || {};
  const byFlagType = new Map();
  let maxRawScore = 0;

  Object.entries(attributeScores).forEach(([attribute, scoreObj]) => {
    const flagType = ATTRIBUTE_MAP[attribute];
    if (!flagType) return;

    const rawScore = Number(scoreObj?.summaryScore?.value || 0);
    if (rawScore > maxRawScore) maxRawScore = rawScore;
    const confidence = toPercentScore(rawScore);

    if (!byFlagType.has(flagType) || byFlagType.get(flagType).confidence < confidence) {
      byFlagType.set(flagType, {
        flagType,
        confidence,
        reason: `Perspective ${attribute.toLowerCase()} score ${confidence}/100.`,
        snippet: buildSnippet(text),
        provider: "perspective",
        labels: [attribute.toLowerCase()],
      });
    }
  });

  return {
    signals: Array.from(byFlagType.values()),
    score: toPercentScore(maxRawScore),
  };
};

const classify = async ({ text }) => {
  const apiKey = String(process.env.PERSPECTIVE_API_KEY || "").trim();
  if (!apiKey) {
    return {
      skipped: true,
      score: 0,
      signals: [],
      provider: "perspective",
      reason: "PERSPECTIVE_API_KEY is not configured",
      error: null,
    };
  }

  try {
    const response = await analyzePerspective({ text, apiKey });
    const converted = convertResponseToSignals({ text, response });
    return {
      skipped: false,
      provider: "perspective",
      score: converted.score,
      signals: converted.signals,
      reason: null,
      error: null,
    };
  } catch (error) {
    return {
      skipped: true,
      score: 0,
      signals: [],
      provider: "perspective",
      reason: "Perspective request failed; falling back to heuristic moderation",
      error: error?.message || "Unknown Perspective API error",
    };
  }
};

module.exports = {
  classify,
};
