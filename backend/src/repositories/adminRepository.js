const pool = require("../config/db");

const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getDashboardStats = async () => {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS total_users,
      (SELECT COUNT(*)::int FROM restaurants) AS total_restaurants,
      (SELECT COUNT(*)::int FROM restaurants WHERE approval_status = 'pending') AS pending_approvals,
      (SELECT COUNT(*)::int FROM flagged_reviews WHERE status = 'pending') AS flagged_reviews,
      (SELECT COUNT(*)::int FROM reservations WHERE reservation_date = CURRENT_DATE AND status = 'confirmed') AS todays_reservations
  `);
  return result.rows[0];
};

const getRecentActivity = async (limit = 10) => {
  const result = await pool.query(
    `
      SELECT *
      FROM (
        SELECT
          u.created_at,
          'user_registration'::text AS type,
          u.id::int AS entity_id,
          u.full_name AS title,
          u.email AS subtitle
        FROM users u

        UNION ALL

        SELECT
          r.created_at,
          'restaurant_submission'::text AS type,
          r.id::int AS entity_id,
          r.name AS title,
          COALESCE(o.full_name, 'Unknown owner') AS subtitle
        FROM restaurants r
        LEFT JOIN users o ON o.id = r.owner_id

        UNION ALL

        SELECT
          fr.created_at,
          'flagged_review'::text AS type,
          fr.id::int AS entity_id,
          rest.name AS title,
          fr.reason AS subtitle
        FROM flagged_reviews fr
        JOIN reviews rv ON rv.id = fr.review_id
        JOIN restaurants rest ON rest.id = rv.restaurant_id
      ) activity
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );
  return result.rows;
};

const getPendingRestaurants = async () => {
  const result = await pool.query(`
    SELECT
      r.id,
      r.name,
      r.cuisine,
      r.address,
      r.created_at,
      r.owner_id,
      u.full_name AS owner_name,
      u.email AS owner_email
    FROM restaurants r
    LEFT JOIN users u ON u.id = r.owner_id
    WHERE r.approval_status = 'pending'
    ORDER BY r.created_at ASC
  `);
  return result.rows;
};

const approveRestaurant = async (restaurantId) => {
  const result = await pool.query(
    `
      UPDATE restaurants
      SET approval_status = 'approved',
          is_verified = true,
          rejection_reason = NULL,
          updated_at = NOW()
      WHERE id = $1
        AND approval_status = 'pending'
      RETURNING id, name, approval_status, is_verified, updated_at
    `,
    [restaurantId]
  );
  return result.rows[0] || null;
};

const rejectRestaurant = async (restaurantId, rejectionReason) => {
  const result = await pool.query(
    `
      UPDATE restaurants
      SET approval_status = 'rejected',
          is_verified = false,
          rejection_reason = $2,
          updated_at = NOW()
      WHERE id = $1
        AND approval_status = 'pending'
      RETURNING id, name, approval_status, is_verified, rejection_reason, updated_at
    `,
    [restaurantId, rejectionReason]
  );
  return result.rows[0] || null;
};

const listUsers = async ({ page, limit, search, role, suspended }) => {
  const filters = [];
  const values = [];
  let idx = 1;

  if (search) {
    filters.push(`(u.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
    values.push(`%${search}%`);
    idx += 1;
  }

  if (role) {
    filters.push(`r.name = $${idx}`);
    values.push(role);
    idx += 1;
  }

  if (suspended != null) {
    filters.push(`u.is_suspended = $${idx}`);
    values.push(suspended);
    idx += 1;
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const dataQuery = `
    SELECT
      u.id,
      u.full_name,
      u.email,
      r.name AS role,
      u.is_verified,
      u.is_suspended,
      u.suspended_at,
      u.created_at,
      u.updated_at
    FROM users u
    JOIN roles r ON r.id = u.role_id
    ${whereClause}
    ORDER BY u.created_at DESC
    LIMIT $${idx}
    OFFSET $${idx + 1}
  `;

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM users u
    JOIN roles r ON r.id = u.role_id
    ${whereClause}
  `;

  const [dataResult, countResult] = await Promise.all([
    pool.query(dataQuery, [...values, limit, offset]),
    pool.query(countQuery, values),
  ]);

  return {
    users: dataResult.rows,
    total: countResult.rows[0].total,
  };
};

const getUserDetails = async (userId) => {
  const userResult = await pool.query(
    `
      SELECT
        u.id,
        u.full_name,
        u.email,
        r.name AS role,
        u.is_verified,
        u.is_suspended,
        u.suspended_at,
        u.phone,
        u.profile_picture_url,
        u.created_at,
        u.updated_at
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1
    `,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user) return null;

  const reviewsResult = await pool.query(
    `
      SELECT
        rv.id,
        rv.rating,
        rv.comment,
        rv.created_at,
        rest.id AS restaurant_id,
        rest.name AS restaurant_name
      FROM reviews rv
      JOIN restaurants rest ON rest.id = rv.restaurant_id
      WHERE rv.user_id = $1
      ORDER BY rv.created_at DESC
      LIMIT 20
    `,
    [userId]
  );

  return {
    ...user,
    reviews: reviewsResult.rows,
  };
};

const suspendUser = async (userId) => {
  const result = await pool.query(
    `
      UPDATE users
      SET is_suspended = true,
          suspended_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, full_name, email, is_suspended, suspended_at
    `,
    [userId]
  );
  return result.rows[0] || null;
};

const deleteUserAndOwnedData = async (userId) => {
  return withTransaction(async (client) => {
    await client.query(`DELETE FROM restaurants WHERE owner_id = $1`, [userId]);
    const userResult = await client.query(
      `DELETE FROM users WHERE id = $1 RETURNING id, full_name, email`,
      [userId]
    );
    return userResult.rows[0] || null;
  });
};

const getFlaggedReviews = async () => {
  const result = await pool.query(`
    SELECT
      fr.id,
      fr.review_id,
      fr.user_id AS flagger_user_id,
      fr.reason,
      fr.status,
      fr.admin_notes,
      fr.created_at,
      fr.resolved_at,
      rv.rating,
      rv.comment,
      rv.user_id AS reviewer_user_id,
      reviewer.full_name AS reviewer_name,
      rest.id AS restaurant_id,
      rest.name AS restaurant_name,
      flagger.full_name AS flagger_name
    FROM flagged_reviews fr
    JOIN reviews rv ON rv.id = fr.review_id
    JOIN users reviewer ON reviewer.id = rv.user_id
    JOIN users flagger ON flagger.id = fr.user_id
    JOIN restaurants rest ON rest.id = rv.restaurant_id
    ORDER BY
      CASE WHEN fr.status = 'pending' THEN 0 ELSE 1 END,
      fr.created_at DESC
  `);
  return result.rows;
};

const dismissFlaggedReview = async (flagId, adminNotes) => {
  const result = await pool.query(
    `
      UPDATE flagged_reviews
      SET status = 'dismissed',
          admin_notes = COALESCE($2, admin_notes),
          resolved_at = NOW()
      WHERE id = $1
      RETURNING id, review_id, status, admin_notes, resolved_at
    `,
    [flagId, adminNotes || null]
  );
  return result.rows[0] || null;
};

const deleteReviewByFlagId = async (flagId) => {
  return withTransaction(async (client) => {
    const flagResult = await client.query(
      `SELECT id, review_id FROM flagged_reviews WHERE id = $1`,
      [flagId]
    );
    const flag = flagResult.rows[0];
    if (!flag) return null;

    const deletedReviewResult = await client.query(
      `DELETE FROM reviews WHERE id = $1 RETURNING id, restaurant_id, user_id`,
      [flag.review_id]
    );
    const deletedReview = deletedReviewResult.rows[0];
    if (!deletedReview) return null;

    return {
      flag_id: flag.id,
      review_id: deletedReview.id,
      restaurant_id: deletedReview.restaurant_id,
      reviewer_user_id: deletedReview.user_id,
    };
  });
};

const insertAuditLog = async ({ adminId, action, entityType, entityId = null, details = null }) => {
  await pool.query(
    `
      INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `,
    [adminId, action, entityType, entityId, details ? JSON.stringify(details) : null]
  );
};

module.exports = {
  getDashboardStats,
  getRecentActivity,
  getPendingRestaurants,
  approveRestaurant,
  rejectRestaurant,
  listUsers,
  getUserDetails,
  suspendUser,
  deleteUserAndOwnedData,
  getFlaggedReviews,
  dismissFlaggedReview,
  deleteReviewByFlagId,
  insertAuditLog,
};

