const DEFAULT_PARSED = Object.freeze({
  intent: "restaurant_search",
  greeting: false,
  identityQuestion: false,
  outOfScope: false,
  needsClarification: false,
  clarificationQuestion: "",
  restaurantName: "",
  cuisines: [],
  dietarySupport: [],
  priceRanges: [],
  vibe: [],
  openNow: false,
  useProximity: false,
  distanceRadiusKm: null,
  minRating: null,
  maxRating: null,
  sortBy: "",
  partySize: null,
  availabilityDate: "",
  availabilityTime: "",
  summary: ""
});

const CUISINE_KEYWORDS = new Map([
  ["italian", "Italian"],
  ["pizza", "Italian"],
  ["pasta", "Italian"],
  ["risotto", "Italian"],

  ["japanese", "Japanese"],
  ["sushi", "Japanese"],
  ["ramen", "Japanese"],
  ["yakitori", "Japanese"],

  ["middle eastern", "Middle Eastern"],
  ["middle-eastern", "Middle Eastern"],
  ["lebanese", "Middle Eastern"],
  ["shawarma", "Middle Eastern"],
  ["shawerma", "Middle Eastern"],
  ["batata", "Middle Eastern"],
  ["batata harra", "Middle Eastern"],
  ["falafel", "Middle Eastern"],
  ["kebbeh", "Middle Eastern"],
  ["kibbeh", "Middle Eastern"],

  ["mexican", "Mexican"],
  ["taco", "Mexican"],
  ["tacos", "Mexican"],
  ["burrito", "Mexican"],
  ["burritos", "Mexican"],

  ["american", "American"],
  ["burger", "American"],
  ["burgers", "American"],
  ["bbq", "American"],
  ["barbecue", "American"],

  ["indian", "Indian"],
  ["curry", "Indian"],
  ["biryani", "Indian"],

  ["chinese", "Chinese"],
  ["dumpling", "Chinese"],
  ["dumplings", "Chinese"],

  ["thai", "Thai"],
  ["pad thai", "Thai"],

  ["korean", "Korean"],
  ["bibimbap", "Korean"],

  ["seafood", "Seafood"],
  ["steak", "Steakhouse"],
  ["steakhouse", "Steakhouse"],

  ["breakfast", "Breakfast"],
  ["brunch", "Breakfast"],

  ["international", "International"],
  ["global", "International"],
  ["fusion", "International"],
  ["world cuisine", "International"],
  ["world cuisines", "International"],
  ["international cuisine", "International"],
  ["international cuisines", "International"],

  ["vegan", "Vegan"],
  ["vegetarian", "Vegetarian"]
]);

const DIETARY_KEYWORDS = new Map([
  ["vegan", "vegan"],
  ["vegetarian", "vegetarian"],
  ["halal", "halal"],
  ["gluten free", "gluten-free"],
  ["gluten-free", "gluten-free"],
  ["gf", "gluten-free"],
  ["dairy free", "dairy-free"],
  ["dairy-free", "dairy-free"],
  ["kosher", "kosher"]
]);

const NUMBER_WORDS = new Map([
  ["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5], ["six", 6],
  ["seven", 7], ["eight", 8], ["nine", 9], ["ten", 10], ["eleven", 11], ["twelve", 12]
]);

const MONTH_LOOKUP = new Map([
  ["january", 0], ["jan", 0],
  ["february", 1], ["feb", 1],
  ["march", 2], ["mar", 2],
  ["april", 3], ["apr", 3],
  ["may", 4],
  ["june", 5], ["jun", 5],
  ["july", 6], ["jul", 6],
  ["august", 7], ["aug", 7],
  ["september", 8], ["sep", 8], ["sept", 8],
  ["october", 9], ["oct", 9],
  ["november", 10], ["nov", 10],
  ["december", 11], ["dec", 11],
]);

const RESTAURANT_SUFFIXES_REGEX = /\b(restaurant|restaurants|resto|rest|cafe|café|bistro|grill|place|spot)\b/gi;
const GREETING_ROOTS = ["hi", "hey", "hello", "hiya", "howdy", "marhaba", "ahlan", "salam", "salaam"];
const INSTRUCTION_ATTACK_REGEX = /\b(ignore previous instructions|ignore all previous instructions|forget what (?:you|u) learnt|forget what (?:you|u) learned|forget everything|ignore everything before this|system prompt|developer message)\b/gi;

const foldText = (value = "") => String(value || "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

const collapseStretching = (value = "") => String(value || "").replace(/(.)\1{2,}/g, "$1$1");

const normalizeMessage = (value = "") => collapseStretching(foldText(value))
  .replace(/[^a-z0-9:&$/\-\s?!+.]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const stripInstructionAttacks = (value = "") => String(value || "")
  .replace(INSTRUCTION_ATTACK_REGEX, " ")
  .replace(/\s+/g, " ")
  .trim();

const cleanRestaurantName = (value = "") => String(value || "")
  .replace(RESTAURANT_SUFFIXES_REGEX, " ")
  .replace(/\s+/g, " ")
  .trim();

const compactText = (value = "") => foldText(value).replace(/[^a-z0-9]/g, "");
const unique = (values) => [...new Set((values || []).filter(Boolean))];
const isGenericRestaurantCandidate = (value = "") =>
  /^(best|worst|top|help|restaurant|restaurants|place|places|spot|spots|near|nearby|close|closest|cuisine|cuisines|food|foods)$/.test(compactText(value));

const createParsedResult = (overrides = {}) => ({
  ...DEFAULT_PARSED,
  ...overrides,
  cuisines: unique(overrides.cuisines ?? DEFAULT_PARSED.cuisines),
  dietarySupport: unique(overrides.dietarySupport ?? DEFAULT_PARSED.dietarySupport),
  priceRanges: unique(overrides.priceRanges ?? DEFAULT_PARSED.priceRanges),
  vibe: unique(overrides.vibe ?? DEFAULT_PARSED.vibe),
  clarificationQuestion: String(overrides.clarificationQuestion ?? DEFAULT_PARSED.clarificationQuestion),
  restaurantName: String(overrides.restaurantName ?? DEFAULT_PARSED.restaurantName).trim(),
  availabilityDate: String(overrides.availabilityDate ?? DEFAULT_PARSED.availabilityDate).trim(),
  availabilityTime: String(overrides.availabilityTime ?? DEFAULT_PARSED.availabilityTime).trim(),
  sortBy: String(overrides.sortBy ?? DEFAULT_PARSED.sortBy).trim(),
  summary: String(overrides.summary ?? DEFAULT_PARSED.summary).trim(),
  distanceRadiusKm: overrides.distanceRadiusKm != null && Number.isFinite(Number(overrides.distanceRadiusKm))
    ? Number(overrides.distanceRadiusKm)
    : DEFAULT_PARSED.distanceRadiusKm,
});

const formatIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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

const isApproximateGreetingToken = (token = "") => {
  const compact = compactText(token);
  if (!compact || compact.length > 8) return false;
  if (/^h[ieayoz]+[iyzo]*$/.test(compact)) return true;
  return GREETING_ROOTS.some((root) => levenshteinDistance(compact, root) <= 2);
};

const parseTimeFromMessage = (message = "") => {
  const explicitMatch = String(message).match(/\b(?:at|around|by)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b|\b(\d{1,2})(?::(\d{2}))\s*(am|pm)?\b|\b(\d{1,2})\s*(am|pm)\b/i);
  if (!explicitMatch) return "";

  const hoursSource = explicitMatch[1] || explicitMatch[4] || explicitMatch[7];
  const minutesSource = explicitMatch[2] || explicitMatch[5] || "00";
  const meridiem = (explicitMatch[3] || explicitMatch[6] || explicitMatch[8] || "").toLowerCase();

  let hours = parseInt(hoursSource, 10);
  if (Number.isNaN(hours)) return "";

  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  if (!meridiem && hours <= 11 && /\b(tonight|dinner|evening)\b/i.test(message)) hours += 12;

  if (hours > 23) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutesSource).padStart(2, "0")}:00`;
};

const parseExplicitDate = (message = "", now = new Date()) => {
  const lower = normalizeMessage(message);

  const isoMatch = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const candidate = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
    if (!Number.isNaN(candidate.getTime())) return formatIsoDate(candidate);
  }

  const dayMonthMatch = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\b/);
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1], 10);
    const month = MONTH_LOOKUP.get(dayMonthMatch[2]);
    const year = now.getFullYear();
    const candidate = new Date(year, month, day);
    if (!Number.isNaN(candidate.getTime())) return formatIsoDate(candidate);
  }

  const monthDayMatch = lower.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (monthDayMatch) {
    const month = MONTH_LOOKUP.get(monthDayMatch[1]);
    const day = parseInt(monthDayMatch[2], 10);
    const year = now.getFullYear();
    const candidate = new Date(year, month, day);
    if (!Number.isNaN(candidate.getTime())) return formatIsoDate(candidate);
  }

  return "";
};

const parseDateFromMessage = (message = "", now = new Date()) => {
  const lower = normalizeMessage(message);
  if (lower.includes("tomorrow")) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    return formatIsoDate(date);
  }
  if (/(today|tonight|this evening|right now|now)/.test(lower)) {
    return formatIsoDate(now);
  }
  return parseExplicitDate(message, now);
};

const parsePartySize = (message = "") => {
  const digitMatch = String(message).match(/\b(?:for|party of|table for|party size|reserve|book)\s*(\d{1,2})\b/i)
    || String(message).match(/\b(\d{1,2})\s*(?:people|persons|guests|seats?)\b/i);
  if (digitMatch) return parseInt(digitMatch[1], 10);

  const wordMatch = normalizeMessage(message).match(/\b(?:for|party of|table for|party size)\s*(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/);
  if (wordMatch) return NUMBER_WORDS.get(wordMatch[1]) || null;

  return null;
};

const inferPriceRanges = (message = "") => {
  const lower = normalizeMessage(message);
  const values = [];

  if (/\$\$\$\$/.test(lower)) values.push("$$$$");
  if (/\$\$\$/.test(lower)) values.push("$$$");
  if (/\$\$/.test(lower)) values.push("$$");
  if (/\$/.test(lower)) values.push("$");
  if (/\b(cheap|budget|affordable|inexpensive|low cost|low-cost|value)\b/.test(lower)) values.push("$");
  if (/\b(mid range|mid-range|moderate|average)\b/.test(lower)) values.push("$$");
  if (/\b(expensive|luxury|fancy|fine dining|high end|high-end|premium)\b/.test(lower)) values.push("$$$");

  return unique(values);
};

const inferRatingPreferences = (message = "") => {
  const lower = normalizeMessage(message);
  const aboveMatch = lower.match(/\b([1-5](?:\.\d)?)\s*(?:stars?)?\s*(?:and up|and above|\+|or more)\b/);
  if (aboveMatch) {
    return { minRating: Number(aboveMatch[1]), maxRating: null, sortBy: "rating_desc" };
  }

  const belowMatch = lower.match(/\b(?:under|below|max(?:imum)?|at most)\s*([1-5](?:\.\d)?)\s*(?:stars?)?\b/)
    || lower.match(/\b([1-5](?:\.\d)?)\s*(?:stars?)?\s*(?:and below|or less|or lower)\b/);
  if (belowMatch) {
    return { minRating: null, maxRating: Number(belowMatch[1]), sortBy: "rating_asc" };
  }

  const explicitStars = String(message).match(/\b([1-5](?:\.\d)?)\s*(?:star|stars)\b/i);
  if (explicitStars) {
    return {
      minRating: Number(explicitStars[1]),
      maxRating: null,
      sortBy: "rating_desc"
    };
  }
  if (/\b(best|top|highest rated|top rated|best rated)\b/.test(lower)) {
    return {
      minRating: 5,
      maxRating: null,
      sortBy: "rating_desc"
    };
  }
  if (/\b(worst|lowest rated|one star|1 star)\b/.test(lower)) {
    return {
      minRating: null,
      maxRating: 1,
      sortBy: "rating_asc"
    };
  }
  if (/\b(low rated|low-rated|poorly rated|bad reviews?)\b/.test(lower)) {
    return {
      minRating: null,
      maxRating: 2.5,
      sortBy: "rating_asc"
    };
  }
  if (/\b(highly rated|high rated|well rated|top reviews?)\b/.test(lower)) {
    return {
      minRating: 4,
      maxRating: null,
      sortBy: "rating_desc"
    };
  }
  return {
    minRating: null,
    maxRating: null,
    sortBy: ""
  };
};

const inferCuisines = (message = "") => {
  const lower = normalizeMessage(message);
  const cuisines = [];

  for (const [needle, cuisine] of CUISINE_KEYWORDS.entries()) {
    if (lower.includes(needle)) cuisines.push(cuisine);
  }

  return unique(cuisines);
};

const inferDietarySupport = (message = "") => {
  const lower = normalizeMessage(message);
  const dietarySupport = [];

  for (const [needle, label] of DIETARY_KEYWORDS.entries()) {
    if (lower.includes(needle)) dietarySupport.push(label);
  }

  return unique(dietarySupport);
};

const inferProximityPreferences = (message = "") => {
  const lower = normalizeMessage(message);
  const useProximity = /\b(near me|nearby|close to me|close by|around me|around here|closest|walkable|walking distance|local)\b/.test(lower);

  const kmMatch = lower.match(/\b(?:within|under|inside|in)\s*(\d{1,3}(?:\.\d+)?)\s*(km|kilometer|kilometers|kms)\b/)
    || lower.match(/\b(\d{1,3}(?:\.\d+)?)\s*(km|kilometer|kilometers|kms)\b/);
  if (kmMatch) {
    return {
      useProximity: true,
      distanceRadiusKm: Number(kmMatch[1])
    };
  }

  const mileMatch = lower.match(/\b(?:within|under|inside|in)\s*(\d{1,3}(?:\.\d+)?)\s*(mile|miles|mi)\b/)
    || lower.match(/\b(\d{1,3}(?:\.\d+)?)\s*(mile|miles|mi)\b/);
  if (mileMatch) {
    return {
      useProximity: true,
      distanceRadiusKm: Math.round(Number(mileMatch[1]) * 1.60934 * 10) / 10
    };
  }

  return {
    useProximity,
    distanceRadiusKm: null
  };
};

const isGreeting = (message = "") => {
  const lower = normalizeMessage(message);
  if (!lower) return false;

  if (/\b(good morning|good afternoon|good evening|greetings|howdy|hiya|yo|marhaba|ahlan|salam|salaam)\b/.test(lower)) return true;
  if (/^(hi+|hey+|hello+)( there)?[!.?]*$/.test(lower)) return true;
  if (/^(he+y+|hel+o+|h+i+)[!.?]*$/.test(lower)) return true;

  const tokens = lower.split(/\s+/).filter(Boolean);
  return tokens.length <= 2 && tokens.some((token) => isApproximateGreetingToken(token));
};

const isIdentityQuestion = (message = "") => {
  const lower = normalizeMessage(message);
  return /\b(who are (?:you|u)|who r (?:you|u)|what(?: is|'s) your name|your name|introduce yourself|what can you do|how can you help|can (?:you|u) help me|help me|i need help)\b/.test(lower);
};

const hasFoodSignals = (message = "") => {
  const lower = normalizeMessage(message);
  return inferCuisines(lower).length > 0
    || /\b(restaurant|restaurants|food|dish|eat|dinner|lunch|breakfast|brunch|reservation|reserve|book|open|hours|availability|seats?)\b/.test(lower);
};

const looksOutOfScope = (message = "") => {
  const raw = String(message || "");
  const lower = normalizeMessage(raw);
  if (!lower) return false;

  if (/\b(ignore previous instructions|forget what (?:you|u) learnt|forget what (?:you|u) learned|forget everything|ignore everything before this)\b/.test(lower)) {
    return true;
  }

  if (/\b(weather|stock|stocks|code|programming|javascript|python|politics|news|bitcoin|crypto|river|capital)\b/.test(lower)) {
    return true;
  }

  if (/\bwhat\s+is\s+\d+\s*[+\-*/]\s*\d+\b/i.test(raw) || /\b\d+\s*[+\-*/]\s*\d+\b/.test(raw)) {
    return true;
  }

  if (/\b(math|equation|calculate|solve)\b/.test(lower) && !hasFoodSignals(lower)) {
    return true;
  }

  if (/^(?:what|who|where|when|why|how)\b/.test(lower)
    && !hasFoodSignals(lower)
    && !isIdentityQuestion(lower)
    && !/\b(review|reviews|rating|ratings|rated|star|stars)\b/.test(lower)) {
    return true;
  }

  return false;
};

const hasSearchLanguage = (message = "") => /\b(find|show|suggest|recommend|looking for|search|restaurants|places|spots|options|somewhere|eat|nearby|close|closest|near me|around me)\b/i.test(message);
const hasHoursLanguage = (message = "") => /\b(open|opening|closing|hours)\b|when does .* open|when does .* close|\b(?:is|are)\s+.+?\s+closed\b/i.test(message);
const hasAvailabilityLanguage = (message = "") => /\b(availability|available|seats|seat|table|book|booking|reservation|reserve|accommodate|fit)\b/i.test(message);
const hasPopularityLanguage = (message = "") => /\b(loved|love|popular|worth trying|worth it|good|great|liked|recommend|recommended|well liked|well-liked|famous|best|worst)\b/i.test(message);
const hasReviewLanguage = (message = "") => /\b(review|reviews|rating|ratings|rated|star|stars|bad reviews?|good reviews?)\b/i.test(message);

const extractRestaurantFromAvailabilityContext = (message = "") => {
  const normalized = String(message || "").replace(/\s+/g, " ").trim();
  const contextualMatch = normalized.match(/\b(?:at|for|does|is)\s+(.+?)(?=\s+(?:on|at|for|tonight|tomorrow|today|with|around|by|near|nearby|close|closest|have|has|open|closed)\b|$)/i);
  if (contextualMatch) {
    return cleanRestaurantName(contextualMatch[1]);
  }

  const possessiveReviewMatch = normalized.match(/\bdoes\s+(.+?)\s+have\s+.+\b/i)
    || normalized.match(/\bis\s+(.+?)\s+(?:good|great|popular|worth|open|closed)\b/i);
  if (possessiveReviewMatch) {
    return cleanRestaurantName(possessiveReviewMatch[1]);
  }

  return "";
};

const extractRestaurantCandidate = (message = "") => {
  const direct = extractRestaurantFromAvailabilityContext(message);
  if (direct) return direct;

  const cleaned = String(message || "")
    .replace(/[?!.,]/g, " ")
    .replace(/\b(?:is|are|do|does|did|what|when|which|can|could|would|please|tell|me|show|check|find|for|about|at|by|on|in|the|a|an|there|right|currently|open|opened|close|closed|closing|hours|availability|available|seat|seats|table|tables|reservation|reserve|book|booking|tonight|tomorrow|today|now|party|size|people|loved|popular|worth|trying|it|good|great|liked|recommend(?:ed)?|have|has|bad|review|reviews|rating|ratings|rated|star|stars|help|near|nearby|closest|close)\b/gi, " ")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, " ")
    .replace(/\b(?:january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (wordCount === 0 || wordCount > 5) return "";
  const candidate = cleanRestaurantName(cleaned);
  return isGenericRestaurantCandidate(candidate) ? "" : candidate;
};

const looksLikeRestaurantNameOnly = (message = "", inferred = {}) => {
  const raw = String(message || "").trim();
  if (!raw || raw.length > 80) return false;

  const lower = normalizeMessage(raw);
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  if (wordCount === 0 || wordCount > 5) return false;
  if (isGenericRestaurantCandidate(raw)) return false;
  if (isGreeting(raw) || isIdentityQuestion(raw) || looksOutOfScope(raw)) return false;
  if (hasSearchLanguage(raw) || hasHoursLanguage(raw) || hasAvailabilityLanguage(raw) || hasPopularityLanguage(raw) || hasReviewLanguage(raw)) return false;

  if (
    inferred.cuisines?.length ||
    inferred.priceRanges?.length ||
    inferred.dietarySupport?.length ||
    inferred.partySize ||
    inferred.availabilityTime ||
    inferred.availabilityDate ||
    inferred.minRating != null ||
    inferred.maxRating != null ||
    inferred.sortBy ||
    inferred.useProximity
  ) {
    return false;
  }

  if (/\b(restaurants|restaurant|places|place|spots|spot|cuisine|cuisines|food|foods|dinner|lunch|breakfast|cheap|expensive|vegan|halal|open now|near me|rated)\b/.test(lower)) {
    return false;
  }

  return true;
};

const heuristicParseMessage = (message = "", now = new Date()) => {
  const trimmed = stripInstructionAttacks(String(message || "").trim());
  const cuisines = inferCuisines(trimmed);
  const dietarySupport = inferDietarySupport(trimmed);
  const priceRanges = inferPriceRanges(trimmed);
  const partySize = parsePartySize(trimmed);
  const availabilityDate = parseDateFromMessage(trimmed, now);
  const availabilityTime = parseTimeFromMessage(trimmed);
  const ratingPreferences = inferRatingPreferences(trimmed);
  const proximityPreferences = inferProximityPreferences(trimmed);
  const minRating = ratingPreferences.minRating;
  const maxRating = ratingPreferences.maxRating;
  const sortBy = ratingPreferences.sortBy || (proximityPreferences.useProximity ? "distance" : "");
  const extractedRestaurantCandidate = extractRestaurantCandidate(trimmed);

  if (isGreeting(trimmed)) {
    return createParsedResult({
      intent: "greeting",
      greeting: true,
      summary: "Greeting"
    });
  }

  if (isIdentityQuestion(trimmed)) {
    return createParsedResult({
      intent: "identity",
      identityQuestion: true,
      summary: "Identity question"
    });
  }

  if (looksOutOfScope(trimmed) && !hasFoodSignals(trimmed)) {
    return createParsedResult({
      outOfScope: true,
      summary: "Out of scope"
    });
  }

  const nameOnlyRestaurant = looksLikeRestaurantNameOnly(trimmed, {
    cuisines,
    dietarySupport,
    priceRanges,
    partySize,
    availabilityDate,
    availabilityTime,
    minRating,
    maxRating,
    sortBy,
    useProximity: proximityPreferences.useProximity,
  })
    ? cleanRestaurantName(trimmed) || trimmed
    : "";

  const contextualRestaurantName = (
    hasHoursLanguage(trimmed)
    || hasAvailabilityLanguage(trimmed)
    || hasPopularityLanguage(trimmed)
    || hasReviewLanguage(trimmed)
  )
    ? extractedRestaurantCandidate
    : "";

  const restaurantName = nameOnlyRestaurant || contextualRestaurantName;

  if (hasAvailabilityLanguage(trimmed)) {
    return createParsedResult({
      intent: "availability_check",
      restaurantName,
      cuisines,
      dietarySupport,
      priceRanges,
      partySize,
      availabilityDate,
      availabilityTime,
      useProximity: proximityPreferences.useProximity,
      distanceRadiusKm: proximityPreferences.distanceRadiusKm,
      minRating,
      maxRating,
      sortBy,
      needsClarification: !restaurantName,
      clarificationQuestion: !restaurantName ? "Sure — which restaurant should I check availability for?" : "",
      summary: "Availability request"
    });
  }

  if (hasHoursLanguage(trimmed)) {
    return createParsedResult({
      intent: restaurantName ? "hours_check" : "restaurant_search",
      restaurantName,
      cuisines,
      dietarySupport,
      priceRanges,
      useProximity: proximityPreferences.useProximity,
      distanceRadiusKm: proximityPreferences.distanceRadiusKm,
      openNow: /\b(open now|currently open|open right now)\b/i.test(trimmed),
      minRating,
      maxRating,
      sortBy,
      needsClarification: !restaurantName && cuisines.length === 0,
      clarificationQuestion: !restaurantName && cuisines.length === 0 ? "Which restaurant would you like me to check?" : "",
      summary: restaurantName ? "Restaurant hours" : "Restaurant search"
    });
  }

  if (restaurantName && (hasPopularityLanguage(trimmed) || hasReviewLanguage(trimmed))) {
    return createParsedResult({
      intent: "restaurant_details",
      restaurantName,
      summary: "Restaurant popularity/details"
    });
  }

  if (restaurantName) {
    return createParsedResult({
      intent: "restaurant_details",
      restaurantName,
      summary: "Restaurant details"
    });
  }

  if (
    cuisines.length
    || dietarySupport.length
    || priceRanges.length
    || minRating != null
    || maxRating != null
    || sortBy
    || proximityPreferences.useProximity
    || hasSearchLanguage(trimmed)
    || hasReviewLanguage(trimmed)
  ) {
    return createParsedResult({
      intent: "restaurant_search",
      cuisines,
      dietarySupport,
      priceRanges,
      minRating,
      maxRating,
      sortBy,
      useProximity: proximityPreferences.useProximity,
      distanceRadiusKm: proximityPreferences.distanceRadiusKm,
      openNow: /\b(open now|currently open|open right now)\b/i.test(trimmed),
      availabilityDate,
      availabilityTime,
      partySize,
      summary: "Restaurant search"
    });
  }

  if (/\b(food|dish|eat|hungry|craving)\b/i.test(trimmed)) {
    return createParsedResult({
      intent: "restaurant_search",
      cuisines,
      dietarySupport,
      priceRanges,
      needsClarification: cuisines.length === 0,
      clarificationQuestion: cuisines.length === 0 ? "Happy to help — what kind of food or restaurant are you in the mood for?" : "",
      summary: cuisines.length ? "Restaurant search" : "Food clarification"
    });
  }

  return createParsedResult({
    intent: "restaurant_search",
    needsClarification: true,
    clarificationQuestion: "Tell me what you’re craving, a restaurant name, or whether you want hours or availability.",
    summary: "Needs clarification"
  });
};

const sanitizeParsedResult = (value) => {
  const base = typeof value === "object" && value ? value : {};
  return createParsedResult({
    intent: typeof base.intent === "string" && base.intent.trim() ? base.intent.trim() : DEFAULT_PARSED.intent,
    greeting: Boolean(base.greeting),
    identityQuestion: Boolean(base.identityQuestion),
    outOfScope: Boolean(base.outOfScope),
    needsClarification: Boolean(base.needsClarification),
    clarificationQuestion: base.clarificationQuestion,
    restaurantName: cleanRestaurantName(base.restaurantName || ""),
    cuisines: Array.isArray(base.cuisines) ? base.cuisines : [],
    dietarySupport: Array.isArray(base.dietarySupport) ? base.dietarySupport : [],
    priceRanges: Array.isArray(base.priceRanges) ? base.priceRanges : [],
    vibe: Array.isArray(base.vibe) ? base.vibe : [],
    openNow: Boolean(base.openNow),
    useProximity: Boolean(base.useProximity),
    distanceRadiusKm: base.distanceRadiusKm,
    minRating: base.minRating != null && Number.isFinite(Number(base.minRating)) ? Number(base.minRating) : null,
    maxRating: base.maxRating != null && Number.isFinite(Number(base.maxRating)) ? Number(base.maxRating) : null,
    sortBy: base.sortBy,
    partySize: base.partySize != null && Number.isFinite(Number(base.partySize)) ? Number(base.partySize) : null,
    availabilityDate: base.availabilityDate,
    availabilityTime: base.availabilityTime,
    summary: base.summary
  });
};

const mergeParsedResults = (primary, fallback) => {
  const safePrimary = sanitizeParsedResult(primary);
  const safeFallback = sanitizeParsedResult(fallback);

  const merged = createParsedResult({
    ...safePrimary,
    greeting: safePrimary.greeting || safeFallback.greeting,
    identityQuestion: safePrimary.identityQuestion || safeFallback.identityQuestion,
    outOfScope: safePrimary.outOfScope && !safeFallback.cuisines.length && !safeFallback.restaurantName,
    needsClarification: safePrimary.needsClarification,
    clarificationQuestion: safePrimary.clarificationQuestion || safeFallback.clarificationQuestion,
    restaurantName: safePrimary.restaurantName || safeFallback.restaurantName,
    cuisines: safePrimary.cuisines.length ? safePrimary.cuisines : safeFallback.cuisines,
    dietarySupport: safePrimary.dietarySupport.length ? safePrimary.dietarySupport : safeFallback.dietarySupport,
    priceRanges: safePrimary.priceRanges.length ? safePrimary.priceRanges : safeFallback.priceRanges,
    vibe: safePrimary.vibe.length ? safePrimary.vibe : safeFallback.vibe,
    openNow: safePrimary.openNow || safeFallback.openNow,
    useProximity: safePrimary.useProximity || safeFallback.useProximity,
    distanceRadiusKm: safePrimary.distanceRadiusKm != null ? safePrimary.distanceRadiusKm : safeFallback.distanceRadiusKm,
    minRating: safePrimary.minRating != null ? safePrimary.minRating : safeFallback.minRating,
    maxRating: safePrimary.maxRating != null ? safePrimary.maxRating : safeFallback.maxRating,
    sortBy: safePrimary.sortBy || safeFallback.sortBy,
    partySize: safePrimary.partySize != null ? safePrimary.partySize : safeFallback.partySize,
    availabilityDate: safePrimary.availabilityDate || safeFallback.availabilityDate,
    availabilityTime: safePrimary.availabilityTime || safeFallback.availabilityTime,
    summary: safePrimary.summary || safeFallback.summary,
  });

  if (safePrimary.needsClarification && safeFallback.restaurantName) {
    merged.intent = safeFallback.intent;
    merged.restaurantName = safeFallback.restaurantName;
    merged.needsClarification = false;
    merged.clarificationQuestion = "";
  }

  if (merged.identityQuestion) {
    merged.intent = "identity";
    merged.outOfScope = false;
    merged.needsClarification = false;
  }

  if (merged.greeting) {
    merged.intent = "greeting";
    merged.outOfScope = false;
    merged.needsClarification = false;
  }

  if (merged.intent === "restaurant_search" && merged.restaurantName && !merged.cuisines.length && !merged.priceRanges.length && !merged.dietarySupport.length && !merged.openNow && !merged.useProximity && merged.minRating == null && merged.maxRating == null) {
    merged.intent = "restaurant_details";
  }

  return merged;
};

module.exports = {
  DEFAULT_PARSED,
  cleanRestaurantName,
  compactText,
  createParsedResult,
  heuristicParseMessage,
  mergeParsedResults,
  normalizeMessage,
  sanitizeParsedResult,
};