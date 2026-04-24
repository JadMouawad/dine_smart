const bcrypt = require("bcrypt");
const pool = require("../config/db");
const profileRepository = require("../repositories/profileRepository");
const loyaltyService = require("./loyaltyService");

const SALT_ROUNDS = 10;
const ACCOUNT_DELETION_CONFIRMATION_TEXT = "Goodbye DineSmart";
const normalizeDeletionConfirmation = (value) => String(value || "")
  .trim()
  .replace(/^[\s"'“”]+|[\s"'“”]+$/g, "")
  .replace(/\s+/g, " ")
  .toLowerCase();

const resolveLoyaltyBadge = (reservationCount) => {
  if (reservationCount >= 30) return "Regular";
  if (reservationCount >= 15) return "Foodie";
  if (reservationCount >= 5) return "Explorer";
  return "Newcomer";
};

const getProfile = async (userId) => {
  const [profile, reservationCount, reviews, reviewsRequiringChanges, rewardStatus] = await Promise.all([
    profileRepository.getById(userId),
    profileRepository.getReservationCountByUserId(userId),
    profileRepository.getReviewsByUserId(userId),
    profileRepository.getReviewsRequiringChangesByUserId(userId),
    loyaltyService.getRewardStatus({ userId }),
  ]);

  if (!profile) return null;
  return {
    ...profile,
    reservation_count: reservationCount,
    loyalty_badge: resolveLoyaltyBadge(reservationCount),
    my_reviews: reviews,
    reviews_requiring_changes: reviewsRequiringChanges,
    reward_status: rewardStatus,
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

const deleteProfileAccount = async ({ userId, confirmationText }) => {
  const normalizedConfirmation = normalizeDeletionConfirmation(confirmationText);
  const expectedConfirmation = normalizeDeletionConfirmation(ACCOUNT_DELETION_CONFIRMATION_TEXT);
  if (normalizedConfirmation !== expectedConfirmation) {
    return {
      success: false,
      status: 400,
      error: `Please type ${ACCOUNT_DELETION_CONFIRMATION_TEXT} to confirm account deletion.`,
    };
  }

  const parsedUserId = parseInt(userId, 10);
  if (Number.isNaN(parsedUserId)) {
    return { success: false, status: 400, error: "Invalid user ID" };
  }

  const existing = await profileRepository.getById(parsedUserId);
  if (!existing) {
    return { success: false, status: 404, error: "Profile not found" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM restaurants WHERE owner_id = $1`, [parsedUserId]);
    const deletedUserResult = await client.query(
      `DELETE FROM users WHERE id = $1 RETURNING id, full_name, email`,
      [parsedUserId]
    );
    await client.query("COMMIT");

    const deletedUser = deletedUserResult.rows[0] || null;
    if (!deletedUser) {
      return { success: false, status: 404, error: "Profile not found" };
    }

    return {
      success: true,
      status: 200,
      data: deletedUser,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getProfile,
  updateProfile,
  deleteProfileAccount,
};
