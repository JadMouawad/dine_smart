const { FLAG_TYPES } = require("../constants");
const { normalizeText, getTokens, buildSnippet } = require("../normalization");

const DEFAULT_BAD_WORDS = [
  "fuck",
  "fck",
  "shit",
  "bitch",
  "asshole",
  "dumbass",
  "bastard",
  "cunt",
  "whore",
  "slut",
  "motherfucker",
  "nigger",
  "niga",
  "faggot",
  "retard",
  "kys",
];

const PROFANITY_LIST = String(process.env.BAD_WORDS || "")
  .split(",")
  .map((word) => word.trim().toLowerCase())
  .filter(Boolean);

const BAD_WORDS = Array.from(new Set([...DEFAULT_BAD_WORDS, ...PROFANITY_LIST]));

// Explicit masks for commonly censored profanity variants.
const CENSORED_PROFANITY_PATTERNS = [
  /\bf[\W_]*(?:u|\*|v)?[\W_]*c[\W_]*k(?:[\W_]*i[\W_]*n[\W_]*g)?\b/i,
  /\bf[\W_]*\*+[\W_]*c[\W_]*k+\b/i,
  /\bs[\W_]*h[\W_]*i[\W_]*t+\b/i,
  /\bb[\W_]*i[\W_]*t[\W_]*c[\W_]*h+\b/i,
  /\ba[\W_]*s[\W_]*s+\b/i,
  /\bc[\W_]*u[\W_]*n[\W_]*t+\b/i,
  /\bn[\W_]*i[\W_]*g[\W_]*g[\W_]*e[\W_]*r+\b/i,
  /\bf[\W_]*a[\W_]*g[\W_]*g[\W_]*o[\W_]*t+\b/i,
];

const SPAM_PATTERNS = [
  /\b(?:call|whatsapp|telegram|dm me|message me|contact me)\b/i,
  /\b(?:promo|discount|offer|deal|coupon|sponsored)\b/i,
  /\b(?:buy now|click here|visit my|subscribe|follow me|limited time)\b/i,
  /(https?:\/\/|www\.)/i,
  /\b(?:bitcoin|crypto|forex|airdrop|nft)\b/i,
];

const HARASSMENT_PATTERNS = [
  /\b(?:idiot|moron|stupid|trash|garbage|loser|clown)\b/i,
  /\b(?:kill yourself|kys|drop dead|go die)\b/i,
  /\b(?:i will|we will).{0,20}(?:hurt|attack|destroy|burn|beat)\b/i,
  /\b(?:owner|staff|waiter|manager|chef).{0,25}\b(?:is|are)\b.{0,25}\b(?:stupid|useless|thief|scammer|animals?)\b/i,
];

const OFF_TOPIC_HINTS = [
  /\b(?:politics|election|government|president|parliament)\b/i,
  /\b(?:crypto|forex|stocks?|trading signal|airdrop)\b/i,
  /\b(?:youtube|tiktok|instagram|follow my channel|subscribe)\b/i,
  /\b(?:homework|assignment|coding|javascript|react|python)\b/i,
  /\b(?:loan|casino|betting|gambling)\b/i,
];

const RESTAURANT_CONTEXT_HINTS = [
  /\b(?:food|dish|meal|menu|taste|flavor|portion|price)\b/i,
  /\b(?:restaurant|cafe|place|table|reservation|booking)\b/i,
  /\b(?:staff|service|waiter|manager|owner|clean|ambience)\b/i,
  /\b(?:dinner|lunch|breakfast|dessert|drink)\b/i,
];

const MISLEADING_PATTERNS = [/\b(?:100% fake|definitely fake|everyone is paid|never open once ever)\b/i];
const REPEATED_CHAR_PATTERN = /(.)\1{5,}/;
const DUPLICATE_WORD_PATTERN = /\b(\w+)\b(?:\s+\1\b){3,}/i;

const isOffTopic = (text) => {
  const hasOffTopicHints = OFF_TOPIC_HINTS.some((pattern) => pattern.test(text));
  if (!hasOffTopicHints) return false;
  const hasRestaurantContext = RESTAURANT_CONTEXT_HINTS.some((pattern) => pattern.test(text));
  return !hasRestaurantContext;
};

const countTokenProfanityHits = (tokens) => {
  if (!tokens.length) return 0;
  const tokenSet = new Set(tokens);
  return BAD_WORDS.reduce((count, word) => (tokenSet.has(word) ? count + 1 : count), 0);
};

const countPatternHits = (text, patterns) => patterns.reduce((count, pattern) => (pattern.test(text) ? count + 1 : count), 0);

const classify = ({ text, rating }) => {
  const rawText = String(text || "");
  const normalized = normalizeText(rawText);
  if (!normalized) return [];

  const tokens = getTokens(normalized);
  const signals = [];

  const tokenProfanityHits = countTokenProfanityHits(tokens);
  const censoredProfanityHits = countPatternHits(rawText, CENSORED_PROFANITY_PATTERNS);
  const profanityHits = tokenProfanityHits + censoredProfanityHits;
  if (profanityHits > 0) {
    signals.push({
      flagType: FLAG_TYPES.PROFANITY,
      confidence: Math.min(99, 58 + profanityHits * 11),
      reason: `Detected explicit language (${profanityHits} profanity indicator${profanityHits > 1 ? "s" : ""}).`,
      snippet: buildSnippet(rawText),
      provider: "heuristic",
      labels: ["profanity", "censored_profanity"].slice(0, profanityHits > tokenProfanityHits ? 2 : 1),
    });
  }

  const harassmentHits = countPatternHits(rawText, HARASSMENT_PATTERNS);
  if (harassmentHits > 0) {
    signals.push({
      flagType: FLAG_TYPES.HARASSMENT,
      confidence: Math.min(98, 60 + harassmentHits * 13),
      reason: "Detected personal attack, threat, or abusive language toward people.",
      snippet: buildSnippet(rawText),
      provider: "heuristic",
      labels: ["harassment", "threat"],
    });
  }

  const spamHits = countPatternHits(rawText, SPAM_PATTERNS);
  const looksDuplicated = DUPLICATE_WORD_PATTERN.test(normalized) || REPEATED_CHAR_PATTERN.test(rawText);
  if (spamHits > 0 || looksDuplicated) {
    const score = 48 + spamHits * 15 + (looksDuplicated ? 14 : 0);
    signals.push({
      flagType: FLAG_TYPES.SPAM,
      confidence: Math.min(97, score),
      reason: looksDuplicated
        ? "Detected spam-like repeated wording or promotional patterns."
        : "Detected links/promotions that do not belong in a restaurant review.",
      snippet: buildSnippet(rawText),
      provider: "heuristic",
      labels: ["spam", "promotion"],
    });
  }

  if (isOffTopic(rawText)) {
    signals.push({
      flagType: FLAG_TYPES.INAPPROPRIATE_CONTENT,
      confidence: 66,
      reason: "Detected likely off-topic content unrelated to the restaurant experience.",
      snippet: buildSnippet(rawText),
      provider: "heuristic",
      labels: ["off_topic"],
    });
  }

  const fakeScoreSignals = [];
  if (rating === 1 || rating === 5) {
    if (tokens.length < 6) fakeScoreSignals.push(15);
    if (tokens.length <= 3) fakeScoreSignals.push(25);
  }
  if (countPatternHits(rawText, [/\bbest ever\b/i, /\bworst ever\b/i, /\bscam\b/i, /\bfake reviews?\b/i]) > 0) {
    fakeScoreSignals.push(20);
  }
  if (fakeScoreSignals.length > 0) {
    const confidence = Math.min(92, 42 + fakeScoreSignals.reduce((sum, value) => sum + value, 0));
    signals.push({
      flagType: FLAG_TYPES.FAKE_REVIEW,
      confidence,
      reason: "Suspicious pattern (extreme sentiment with little context or repetitive claims).",
      snippet: buildSnippet(rawText),
      provider: "heuristic",
      labels: ["fake_review_pattern"],
    });
  }

  const misleadingHits = countPatternHits(rawText, MISLEADING_PATTERNS);
  if (misleadingHits > 0) {
    signals.push({
      flagType: FLAG_TYPES.MISLEADING,
      confidence: Math.min(90, 56 + misleadingHits * 11),
      reason: "Detected potentially absolute or unverifiable claims.",
      snippet: buildSnippet(rawText),
      provider: "heuristic",
      labels: ["misleading_claim"],
    });
  }

  return signals;
};

module.exports = {
  classify,
};
