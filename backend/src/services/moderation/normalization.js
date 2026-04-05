const crypto = require("crypto");

const LEET_MAP = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  "$": "s",
  "!": "i",
};

const normalizeText = (value) => {
  const raw = String(value || "").toLowerCase();
  if (!raw.trim()) return "";

  const leetNormalized = raw
    .split("")
    .map((ch) => LEET_MAP[ch] || ch)
    .join("");

  return leetNormalized.replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
};

const getTokens = (value) => normalizeText(value).split(/\s+/).filter(Boolean);

const toPercentScore = (value) => {
  if (value == null || Number.isNaN(Number(value))) return 0;
  const bounded = Math.max(0, Math.min(1, Number(value)));
  return Math.round(bounded * 100);
};

const hashText = (value) => {
  const input = String(value || "");
  return crypto.createHash("sha256").update(input).digest("hex");
};

const buildSnippet = (text, maxLength = 120) => {
  const clean = String(text || "").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 3)}...`;
};

module.exports = {
  normalizeText,
  getTokens,
  toPercentScore,
  hashText,
  buildSnippet,
};
