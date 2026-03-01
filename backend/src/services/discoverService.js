const discoverRepository = require("../repositories/discoverRepository");
const profileRepository = require("../repositories/profileRepository");

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const parseNullableNumber = (value) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getDiscoverFeed = async ({ userId, query }) => {
  const limit = Math.min(parsePositiveInt(query.limit, 8), 20);
  let latitude = parseNullableNumber(query.latitude);
  let longitude = parseNullableNumber(query.longitude);
  const distanceRadius = parseNullableNumber(query.distance_radius);
  if (latitude == null || longitude == null) {
    try {
      const profile = await profileRepository.getById(userId);
      const profileLatitude = parseNullableNumber(profile?.latitude);
      const profileLongitude = parseNullableNumber(profile?.longitude);
      latitude = profileLatitude;
      longitude = profileLongitude;
    } catch (_) {
      latitude = null;
      longitude = null;
    }
  }
  const hasCoords = latitude != null && longitude != null;

  const [preferredCuisines, nearYou, popularRightNow, upcomingEventsNearby, highlyRated] = await Promise.all([
    discoverRepository.getPreferredCuisinesByUser(userId, 3),
    discoverRepository.getNearYou({
      latitude: hasCoords ? latitude : null,
      longitude: hasCoords ? longitude : null,
      radiusKm: hasCoords ? distanceRadius : null,
      limit,
    }),
    discoverRepository.getPopularRightNow({
      latitude: hasCoords ? latitude : null,
      longitude: hasCoords ? longitude : null,
      radiusKm: hasCoords ? distanceRadius : null,
      limit,
    }),
    discoverRepository.getUpcomingEventsNearby({
      latitude: hasCoords ? latitude : null,
      longitude: hasCoords ? longitude : null,
      radiusKm: null,
      limit,
    }),
    discoverRepository.getHighlyRated({
      latitude: hasCoords ? latitude : null,
      longitude: hasCoords ? longitude : null,
      radiusKm: hasCoords ? distanceRadius : null,
      limit,
    }),
  ]);

  const matchesPreferences = await discoverRepository.getMatchesPreferences({
    preferredCuisines,
    latitude: hasCoords ? latitude : null,
    longitude: hasCoords ? longitude : null,
    radiusKm: hasCoords ? distanceRadius : null,
    limit,
  });

  return {
    near_you: nearYou,
    popular_right_now: popularRightNow,
    matches_preferences: matchesPreferences,
    upcoming_events_nearby: upcomingEventsNearby,
    highly_rated: highlyRated,
  };
};

module.exports = {
  getDiscoverFeed,
};
