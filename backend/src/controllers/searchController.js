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
    const priceRanges = parseArray(req.query.price_range);
    const dietarySupport = parseArray(req.query.dietary_support);
    const availabilitySlot = parseAvailabilitySlot(req.query.availability_slot);

    // Public search remains gated to approved restaurants.
    const verifiedOnly = true;

    const results = await searchService.searchRestaurants({
      query,
      cuisines,
      filters: {
        minRating: parseNumber(req.query.min_rating, null),
        priceRanges,
        verifiedOnly,
        dietarySupport,
        openNow: parseBoolean(req.query.open_now, null),
        availabilityDate: req.query.availability_date ? String(req.query.availability_date).trim() : (availabilitySlot?.date || null),
        availabilityTime: req.query.availability_time ? String(req.query.availability_time).trim() : (availabilitySlot?.time || null),
        latitude: parseNumber(req.query.latitude, null),
        longitude: parseNumber(req.query.longitude, null),
        distanceRadius: parseNumber(req.query.distance_radius, null),
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

module.exports = {
  searchRestaurants,
  saveSearch,
  getSavedSearches,
  deleteSavedSearch,
};
