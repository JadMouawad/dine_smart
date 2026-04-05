const pool = require("../config/db");

let restaurantColumnsCache = null;

const getRestaurantColumns = async () => {
  if (restaurantColumnsCache) return restaurantColumnsCache;
  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurants'
  `);
  restaurantColumnsCache = new Set(result.rows.map((row) => row.column_name));
  return restaurantColumnsCache;
};

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
      (SELECT COUNT(*)::int FROM reservations WHERE reservation_date = CURRENT_DATE AND status IN ('accepted', 'confirmed')) AS todays_reservations
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
  const restaurantColumns = await getRestaurantColumns();
  const businessLicenseUrlSelect = restaurantColumns.has("business_license_url")
    ? "r.business_license_url"
    : "NULL::text AS business_license_url";
  const businessLicenseNameSelect = restaurantColumns.has("business_license_name")
    ? "r.business_license_name"
    : "NULL::varchar AS business_license_name";

  const result = await pool.query(`
    SELECT
      r.id,
      r.name,
      r.cuisine,
      r.address,
      ${businessLicenseUrlSelect},
      ${businessLicenseNameSelect},
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
      WITH updated AS (
        UPDATE restaurants
        SET approval_status = 'approved',
            is_verified = true,
            rejection_reason = NULL,
            updated_at = NOW()
        WHERE id = $1
          AND approval_status = 'pending'
        RETURNING id, name, approval_status, is_verified, updated_at, owner_id
      )
      SELECT updated.*,
             u.email AS owner_email,
             u.full_name AS owner_name
      FROM updated
      LEFT JOIN users u ON u.id = updated.owner_id
    `,
    [restaurantId]
  );
  return result.rows[0] || null;
};

const rejectRestaurant = async (restaurantId, rejectionReason) => {
  const result = await pool.query(
    `
      WITH updated AS (
        UPDATE restaurants
        SET approval_status = 'rejected',
            is_verified = false,
            rejection_reason = $2,
            updated_at = NOW()
        WHERE id = $1
          AND approval_status = 'pending'
        RETURNING id, name, approval_status, is_verified, rejection_reason, updated_at, owner_id
      )
      SELECT updated.*,
             u.email AS owner_email,
             u.full_name AS owner_name
      FROM updated
      LEFT JOIN users u ON u.id = updated.owner_id
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
    // Orphan restaurants instead of deleting them — the FK is ON DELETE SET NULL
    // so the restaurant data is preserved for admin records even after owner removal.
    await client.query(`UPDATE restaurants SET owner_id = NULL WHERE owner_id = $1`, [userId]);
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
      fr.source_type,
      fr.flag_type,
      fr.confidence,
      fr.severity,
      fr.snippet,
      fr.suggested_action,
      fr.moderator_action,
      fr.resolution_label,
      fr.moderation_metadata,
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
      COALESCE(flagger.full_name, 'System') AS flagger_name,
      CASE
        WHEN fr.source_type = 'USER_REPORT' THEN 'user'
        WHEN fr.source_type IN ('SYSTEM_AI', 'SYSTEM_RULE') THEN 'system'
        ELSE 'unknown'
      END AS flagged_by
    FROM flagged_reviews fr
    JOIN reviews rv ON rv.id = fr.review_id
    JOIN users reviewer ON reviewer.id = rv.user_id
    LEFT JOIN users flagger ON flagger.id = fr.user_id
    JOIN restaurants rest ON rest.id = rv.restaurant_id
    ORDER BY
      CASE WHEN fr.status = 'pending' THEN 0 ELSE 1 END,
      COALESCE(fr.confidence, 0) DESC,
      fr.created_at DESC
  `);
  return result.rows;
};

const applyModerationActionByFlagId = async ({ flagId, action, adminNotes, resolutionLabel = null }) => {
  const normalizedAction = String(action || "").toUpperCase();

  if (normalizedAction === "DELETE") {
    const deleted = await deleteReviewByFlagId(flagId);
    if (!deleted) return null;
    return {
      action: normalizedAction,
      status: "resolved",
      moderator_action: normalizedAction,
      ...deleted,
    };
  }

  let status = "resolved";
  if (normalizedAction === "DISMISS") {
    status = "dismissed";
  }

  const result = await pool.query(
    `
      UPDATE flagged_reviews
      SET status = $2,
          moderator_action = $3,
          resolution_label = COALESCE($4, resolution_label),
          admin_notes = COALESCE($5, admin_notes),
          resolved_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, review_id, status, moderator_action, resolution_label, admin_notes, resolved_at
    `,
    [flagId, status, normalizedAction, resolutionLabel, adminNotes || null]
  );

  return result.rows[0] || null;
};

const bulkApplyModerationAction = async ({ flagIds, action, adminNotes, resolutionLabel = null }) => {
  if (!Array.isArray(flagIds) || flagIds.length === 0) {
    return [];
  }

  const uniqueIds = Array.from(new Set(flagIds.map((id) => parseInt(id, 10)).filter((id) => id > 0)));
  if (uniqueIds.length === 0) return [];

  if (String(action || "").toUpperCase() === "DELETE") {
    const deleted = [];
    for (const flagId of uniqueIds) {
      // eslint-disable-next-line no-await-in-loop
      const result = await applyModerationActionByFlagId({ flagId, action: "DELETE", adminNotes, resolutionLabel });
      if (result) deleted.push(result);
    }
    return deleted;
  }

  const normalizedAction = String(action || "").toUpperCase();
  let status = "resolved";
  if (normalizedAction === "DISMISS") status = "dismissed";

  const result = await pool.query(
    `
      UPDATE flagged_reviews
      SET status = $2,
          moderator_action = $3,
          resolution_label = COALESCE($4, resolution_label),
          admin_notes = COALESCE($5, admin_notes),
          resolved_at = NOW(),
          updated_at = NOW()
      WHERE id = ANY($1::int[])
      RETURNING id, review_id, status, moderator_action, resolution_label, admin_notes, resolved_at
    `,
    [uniqueIds, status, normalizedAction, resolutionLabel, adminNotes || null]
  );
  return result.rows;
};

const dismissFlaggedReview = async (flagId, adminNotes) => {
  return applyModerationActionByFlagId({ flagId, action: "DISMISS", adminNotes, resolutionLabel: "FALSE_POSITIVE" });
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

const getSubscribedUsersByPreference = async (updateType) => {
  const result = await pool.query(
    `
      SELECT id, full_name, email, subscription_preferences
      FROM users
      WHERE is_subscribed = true
        AND (
          subscription_preferences IS NULL
          OR array_length(subscription_preferences, 1) IS NULL
          OR $1 = ANY(subscription_preferences)
        )
    `,
    [updateType]
  );
  return result.rows;
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
  applyModerationActionByFlagId,
  bulkApplyModerationAction,
  dismissFlaggedReview,
  deleteReviewByFlagId,
  insertAuditLog,
  getSubscribedUsersByPreference,
};

