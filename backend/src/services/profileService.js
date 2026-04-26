const bcrypt = require("bcrypt");
const pool = require("../config/db");
const profileRepository = require("../repositories/profileRepository");
const loyaltyService = require("./loyaltyService");
const { getPasswordValidationMessage } = require("../validation/passwordValidation");

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
  delete updates.password;
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

const changePassword = async ({ userId, oldPassword, newPassword }) => {
  const currentPassword = String(oldPassword || "");
  const nextPassword = String(newPassword || "");

  if (!currentPassword || !nextPassword) {
    return {
      success: false,
      status: 400,
      error: "Old password and new password are required.",
    };
  }

  const result = await pool.query(
    `
      SELECT id, provider, password
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  const account = result.rows[0] || null;
  if (!account) {
    return {
      success: false,
      status: 404,
      error: "Profile not found",
    };
  }

  if (!account.password) {
    return {
      success: false,
      status: 400,
      error: "This account uses Google sign-in. Password changes are managed in Google.",
    };
  }

  const oldPasswordMatches = await bcrypt.compare(currentPassword, account.password);
  if (!oldPasswordMatches) {
    return {
      success: false,
      status: 400,
      error: "Old password is incorrect.",
    };
  }

  const passwordValidationError = getPasswordValidationMessage(nextPassword);
  if (passwordValidationError) {
    return {
      success: false,
      status: 400,
      error: passwordValidationError,
    };
  }

  const sameAsCurrent = await bcrypt.compare(nextPassword, account.password);
  if (sameAsCurrent) {
    return {
      success: false,
      status: 400,
      error: "New password must be different from the current password.",
    };
  }

  const hashedPassword = await bcrypt.hash(nextPassword, SALT_ROUNDS);
  await pool.query(
    `
      UPDATE users
      SET password = $1,
          provider = 'local',
          updated_at = NOW()
      WHERE id = $2
    `,
    [hashedPassword, userId]
  );

  return {
    success: true,
    status: 200,
    data: {
      message: "Password changed successfully.",
    },
  };
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
  changePassword,
  deleteProfileAccount,
};
