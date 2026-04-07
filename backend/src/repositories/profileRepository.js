const pool = require("../config/db");
const User = require("../models/User");

/**
 * Get profile by user ID
 */
const getById = async (userId) => {
  const result = await pool.query(
    `
      SELECT
        u.id, u.full_name, u.email, u.role_id, u.is_verified, u.provider, u.is_suspended, u.suspended_at,
        u.no_show_count, u.banned_until, u.phone, u.latitude, u.longitude, u.profile_picture_url, u.theme_preference,
        u.points,
        u.created_at, u.updated_at, r.name AS role
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `,
    [userId]
  );
  return result.rows[0] || null;
};

/**
 * Update user profile (allowlisted fields only)
 * Accepts fullName, email, phone, profilePictureUrl, password (hashed by caller)
 */
const updateById = async (userId, data) => {
  const updates = {};
  if (data.fullName !== undefined) updates.full_name = data.fullName;
  if (data.full_name !== undefined) updates.full_name = data.full_name;
  if (data.email !== undefined) updates.email = data.email;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.latitude !== undefined) updates.latitude = data.latitude;
  if (data.longitude !== undefined) updates.longitude = data.longitude;
  if (data.profilePictureUrl !== undefined) updates.profile_picture_url = data.profilePictureUrl;
  if (data.themePreference !== undefined) updates.theme_preference = data.themePreference;
  if (data.password !== undefined) updates.password = data.password;
  if (data.isSubscribed !== undefined) updates.is_subscribed = data.isSubscribed;
  if (data.subscriptionPreferences !== undefined) updates.subscription_preferences = data.subscriptionPreferences;
  if (data.subscription_preferences !== undefined) updates.subscription_preferences = data.subscription_preferences;

  if (Object.keys(updates).length === 0) {
    return await getById(userId);
  }

  const fields = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`);
  const values = Object.values(updates);
  values.push(userId);

  const query = `
    UPDATE users SET ${fields.join(", ")}, updated_at = NOW()
    WHERE id = $${values.length}
  `;
  await pool.query(query, values);
  return await getById(userId);
};

const getReservationCountByUserId = async (userId) => {
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS reservation_count
      FROM reservations
      WHERE user_id = $1
        AND status IN ('accepted', 'confirmed', 'completed', 'no-show')
    `,
    [userId]
  );
  return result.rows[0]?.reservation_count || 0;
};

const getReviewsByUserId = async (userId) => {
  const result = await pool.query(
    `
      SELECT
        rv.id,
        rv.restaurant_id,
        rv.rating,
        rv.comment,
        rv.created_at,
        r.name AS restaurant_name
      FROM reviews rv
      JOIN restaurants r ON r.id = rv.restaurant_id
      WHERE rv.user_id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM flagged_reviews fr
          WHERE fr.review_id = rv.id
            AND fr.status = 'pending'
            AND COALESCE(fr.suggested_action, 'REQUIRES_REVIEW') = 'REQUIRES_REVIEW'
        )
      ORDER BY rv.created_at DESC
    `,
    [userId]
  );

  return result.rows;
};

module.exports = {
  getById,
  updateById,
  getReservationCountByUserId,
  getReviewsByUserId,
};
