const searchService = require("../services/searchService");

const parseBoolean = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

const parseNumber = (value, fallback = null) => {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseArray = (value) => {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeDietarySupport = (values = []) => {
  const mapping = {
    vegetarian: "vegetarian",
    vegan: "vegan",
    halal: "halal",
    gf: "gluten-free",
    glutenfree: "gluten-free",
    "gluten-free": "gluten-free",
    "gluten free": "gluten-free",
    dairyfree: "dairy-free",
    "dairy-free": "dairy-free",
    "dairy free": "dairy-free",
    kosher: "kosher"
  };

  return [...new Set(values
    .map((value) => String(value || "").trim().toLowerCase())
    .map((value) => mapping[value.replace(/\s+/g, " ")] || mapping[value.replace(/[^a-z-]/g, "")] || value)
    .filter(Boolean))];
};

const normalizePriceRanges = (values = []) => {
  const mapped = new Set();

  for (const raw of values) {
    const value = String(raw || "").trim().toLowerCase();
    if (!value) continue;
    if (["$", "$$", "$$$", "$$$$"].includes(value)) {
      mapped.add(value);
      continue;
    }
    if (["cheap", "budget", "affordable", "inexpensive"].includes(value)) {
      mapped.add("$");
      continue;
    }
    if (["moderate", "mid", "mid-range", "average"].includes(value)) {
      mapped.add("$$");
      continue;
    }
    if (["expensive", "premium", "luxury", "fine dining"].includes(value)) {
      mapped.add("$$$");
    }
  }

  return [...mapped];
};

const parseAvailabilitySlot = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  const normalized = raw.replace("T", " ");
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const [, date, time] = match;
  return { date, time };
};

const searchRestaurants = async (req, res) => {
  try {
    const query = req.query.query ? String(req.query.query).trim() : "";
    const cuisines = parseArray(req.query.cuisine);
    const priceRanges = normalizePriceRanges(parseArray(req.query.price_range));
    const dietarySupport = normalizeDietarySupport(parseArray(req.query.dietary_support));
    const availabilitySlot = parseAvailabilitySlot(req.query.availability_slot);

    // Public search remains gated to approved restaurants.
    const verifiedOnly = true;

    const results = await searchService.searchRestaurants({
      query,
      cuisines,
      filters: {
        minRating: parseNumber(req.query.min_rating, null),
        maxRating: parseNumber(req.query.max_rating, null),
        priceRanges,
        verifiedOnly,
        dietarySupport,
        openNow: parseBoolean(req.query.open_now, null),
        availabilityDate: req.query.availability_date ? String(req.query.availability_date).trim() : (availabilitySlot?.date || null),
        availabilityTime: req.query.availability_time ? String(req.query.availability_time).trim() : (availabilitySlot?.time || null),
        partySize: parseNumber(req.query.party_size, null),
        latitude: parseNumber(req.query.latitude, null),
        longitude: parseNumber(req.query.longitude, null),
        distanceRadius: parseNumber(req.query.distance_radius, null),
        onlyLebanon: parseBoolean(req.query.only_lebanon, false) === true,
        sortBy: req.query.sort_by ? String(req.query.sort_by).trim() : "rating",
      },
    });

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const saveSearch = async (req, res) => {
  try {
    const result = await searchService.saveSearch({
      userId: req.user.id,
      name: req.body.name,
      filters: req.body.filters,
    });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(result.status).json(result.data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getSavedSearches = async (req, res) => {
  try {
    const result = await searchService.getSavedSearches({ userId: req.user.id });
    return res.status(result.status).json(result.data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const deleteSavedSearch = async (req, res) => {
  try {
    const result = await searchService.deleteSavedSearch({
      userId: req.user.id,
      savedSearchId: req.params.id,
    });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(result.status).json(result.data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const addRecentSearch = async (req, res) => {
  try {
    const result = await searchService.addRecentSearch({ userId: req.user.id, query: req.body.query });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(200).json({ message: "ok" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getRecentSearches = async (req, res) => {
  try {
    const result = await searchService.getRecentSearches({ userId: req.user.id });
    return res.status(200).json(result.data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const removeRecentSearch = async (req, res) => {
  try {
    const result = await searchService.removeRecentSearch({ userId: req.user.id, searchId: req.params.id });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(200).json({ message: "ok" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const clearRecentSearches = async (req, res) => {
  try {
    await searchService.clearRecentSearches({ userId: req.user.id });
    return res.status(200).json({ message: "ok" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  searchRestaurants,
  saveSearch,
  getSavedSearches,
  deleteSavedSearch,
  addRecentSearch,
  getRecentSearches,
  removeRecentSearch,
  clearRecentSearches,
};