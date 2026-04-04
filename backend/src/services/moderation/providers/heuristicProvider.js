const { FLAG_TYPES } = require("../constants");
const { normalizeText, getTokens, buildSnippet } = require("../normalization");

const DEFAULT_BAD_WORDS = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "dick",
  "piss",
  "cunt",
  "slut",
  "whore",
];

const PROFANITY_LIST = String(process.env.BAD_WORDS || "")
  .split(",")
  .map((word) => word.trim().toLowerCase())
  .filter(Boolean);

const BAD_WORDS = PROFANITY_LIST.length ? PROFANITY_LIST : DEFAULT_BAD_WORDS;

const SPAM_PATTERNS = [
  /\b(?:call|whatsapp|telegram|dm me|message me|contact me)\b/i,
  /\b(?:promo|discount|offer|deal|coupon)\b/i,
  /\b(?:buy now|click here|visit my|subscribe|follow me)\b/i,
  /(https?:\/\/|www\.)/i,
];

const HARASSMENT_PATTERNS = [
  /\b(?:idiot|moron|stupid|trash|garbage|loser)\b/i,
  /\b(?:i will|we will).{0,20}(?:hurt|attack|destroy|report you)\b/i,
  /\b(?:owner|staff|waiter|manager).{0,20}\b(?:is|are)\b.{0,20}\b(?:stupid|useless|thief|scammer)\b/i,
];

const MISLEADING_PATTERNS = [/\b(?:100% fake|definitely fake|everyone is paid|never open once ever)\b/i];

const REPEATED_CHAR_PATTERN = /(.)\1{5,}/;
const DUPLICATE_WORD_PATTERN = /\b(\w+)\b(?:\s+\1\b){3,}/i;

const countProfanityHits = (tokens) => {
  if (!tokens.length) return 0;
  const tokenSet = new Set(tokens);
  return BAD_WORDS.reduce((count, word) => (tokenSet.has(word) ? count + 1 : count), 0);
};

const getPatternHits = (text, patterns) => patterns.reduce((count, pattern) => (pattern.test(text) ? count + 1 : count), 0);

const classify = ({ text, rating }) => {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const tokens = getTokens(normalized);
  const signals = [];

  const profanityHits = countProfanityHits(tokens);
  if (profanityHits > 0) {
    signals.push({
      flagType: FLAG_TYPES.PROFANITY,
      confidence: Math.min(98, 55 + profanityHits * 12),
      reason: `Detected explicit language (${profanityHits} matched term${profanityHits > 1 ? "s" : ""}).`,
      snippet: buildSnippet(text),
      provider: "heuristic",
    });
  }

  const harassmentHits = getPatternHits(text, HARASSMENT_PATTERNS);
  if (harassmentHits > 0) {
    signals.push({
      flagType: FLAG_TYPES.HARASSMENT,
      confidence: Math.min(95, 58 + harassmentHits * 14),
      reason: "Detected language targeting staff/owners with insults or threats.",
      snippet: buildSnippet(text),
      provider: "heuristic",
    });
  }

  const spamHits = getPatternHits(text, SPAM_PATTERNS);
  const looksDuplicated = DUPLICATE_WORD_PATTERN.test(normalized) || REPEATED_CHAR_PATTERN.test(String(text || ""));
  if (spamHits > 0 || looksDuplicated) {
    const score = 45 + spamHits * 15 + (looksDuplicated ? 15 : 0);
    signals.push({
      flagType: FLAG_TYPES.SPAM,
      confidence: Math.min(96, score),
      reason: looksDuplicated
        ? "Detected spam-like repeated wording or promotional patterns."
        : "Detected promotional/off-topic patterns.",
      snippet: buildSnippet(text),
      provider: "heuristic",
    });
  }

  const fakeScoreSignals = [];
  if (rating === 1 || rating === 5) {
    if (tokens.length < 6) fakeScoreSignals.push(15);
    if (tokens.length <= 3) fakeScoreSignals.push(25);
  }
  if (getPatternHits(text, [/\bbest ever\b/i, /\bworst ever\b/i, /\bscam\b/i, /\bfake reviews\b/i]) > 0) {
    fakeScoreSignals.push(20);
  }
  if (fakeScoreSignals.length > 0) {
    const confidence = Math.min(90, 40 + fakeScoreSignals.reduce((a, b) => a + b, 0));
    signals.push({
      flagType: FLAG_TYPES.FAKE_REVIEW,
      confidence,
      reason: "Suspicious review pattern (extreme sentiment with very limited context).",
      snippet: buildSnippet(text),
      provider: "heuristic",
    });
  }

  const misleadingHits = getPatternHits(text, MISLEADING_PATTERNS);
  if (misleadingHits > 0) {
    signals.push({
      flagType: FLAG_TYPES.MISLEADING,
      confidence: Math.min(88, 55 + misleadingHits * 10),
      reason: "Detected potentially absolute/unverifiable claims.",
      snippet: buildSnippet(text),
      provider: "heuristic",
    });
  }

  return signals;
};

module.exports = {
  classify,
};
