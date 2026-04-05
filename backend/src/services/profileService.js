const bcrypt = require("bcrypt");
const profileRepository = require("../repositories/profileRepository");

const SALT_ROUNDS = 10;

const resolveLoyaltyBadge = (reservationCount) => {
  if (reservationCount >= 30) return "Regular";
  if (reservationCount >= 15) return "Foodie";
  if (reservationCount >= 5) return "Explorer";
  return "Newcomer";
};

const getProfile = async (userId) => {
  const [profile, reservationCount, reviews] = await Promise.all([
    profileRepository.getById(userId),
    profileRepository.getReservationCountByUserId(userId),
    profileRepository.getReviewsByUserId(userId),
  ]);

  if (!profile) return null;
  return {
    ...profile,
    reservation_count: reservationCount,
    loyalty_badge: resolveLoyaltyBadge(reservationCount),
    my_reviews: reviews,
  };
};

const updateProfile = async (userId, data) => {
  const updates = { ...data };
  if (updates.latitude !== undefined) {
    const parsedLatitude = Number(updates.latitude);
    updates.latitude = Number.isFinite(parsedLatitude) ? parsedLatitude : null;
  }
  if (updates.longitude !== undefined) {
    const parsedLongitude = Number(updates.longitude);
    updates.longitude = Number.isFinite(parsedLongitude) ? parsedLongitude : null;
  }
  if (updates.password != null && updates.password !== "") {
    updates.password = await bcrypt.hash(updates.password, SALT_ROUNDS);
  } else {
    delete updates.password;
  }
  if (updates.isSubscribed !== undefined) {
    const normalized = String(updates.isSubscribed).trim().toLowerCase();
    updates.isSubscribed = normalized === "true" || updates.isSubscribed === true;
  }
  if (updates.subscriptionPreferences !== undefined) {
    if (Array.isArray(updates.subscriptionPreferences)) {
      updates.subscriptionPreferences = updates.subscriptionPreferences.map((item) => String(item).trim()).filter(Boolean);
    } else if (updates.subscriptionPreferences == null) {
      updates.subscriptionPreferences = [];
    }
  }
  return await profileRepository.updateById(userId, updates);
};

module.exports = {
  getProfile,
  updateProfile
};
