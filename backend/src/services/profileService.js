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
  const [profile, reservationCount] = await Promise.all([
    profileRepository.getById(userId),
    profileRepository.getReservationCountByUserId(userId),
  ]);

  if (!profile) return null;
  return {
    ...profile,
    reservation_count: reservationCount,
    loyalty_badge: resolveLoyaltyBadge(reservationCount),
  };
};

const updateProfile = async (userId, data) => {
  const updates = { ...data };
  if (updates.password != null && updates.password !== "") {
    updates.password = await bcrypt.hash(updates.password, SALT_ROUNDS);
  } else {
    delete updates.password;
  }
  return await profileRepository.updateById(userId, updates);
};

module.exports = {
  getProfile,
  updateProfile
};
