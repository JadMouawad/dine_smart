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
      (SELECT COUNT(*)::int FROM flagged_reviews WHERE status = 'pending' AND admin_hidden_at IS NULL) AS flagged_reviews,
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
        WHERE fr.admin_hidden_at IS NULL
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

  const result = await pool.query(`
    SELECT
      r.id,
      r.name,
      r.cuisine,
      r.description,
      r.address,
      r.phone,
      r.rating,
      r.owner_id,
      r.opening_time,
      r.closing_time,
      r.latitude,
      r.longitude,
      r.price_range,
      r.dietary_support,
      r.logo_url,
      r.cover_url,
      r.gallery_urls,
      r.business_license_url,
      r.business_license_name,
      r.health_certificate_url,
      r.health_certificate_name,
      r.is_verified,
      r.approval_status,
      r.rejection_reason,
      r.created_at,
      r.updated_at,
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
      u.no_show_count,
      u.banned_until,
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
        u.no_show_count,
        u.banned_until,
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

const unbanUser = async (userId) => {
  const result = await pool.query(
    `
      UPDATE users
      SET is_suspended = false,
          suspended_at = NULL,
          no_show_count = 0,
          banned_until = NULL,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, full_name, email, is_suspended, suspended_at, no_show_count, banned_until
    `,
    [userId]
  );
  return result.rows[0] || null;
};

const deleteUserAndOwnedData = async (userId) => {
  return withTransaction(async (client) => {
    // Ensure owner-owned data is fully removed when deleting an account.
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
    WHERE fr.admin_hidden_at IS NULL
    ORDER BY
      CASE WHEN fr.status = 'pending' THEN 0 ELSE 1 END,
      COALESCE(fr.confidence, 0) DESC,
      fr.created_at DESC
  `);
  return result.rows;
};

const hideFlaggedReviewForAdmin = async ({ flagId, adminId }) => {
  const result = await pool.query(
    `
      UPDATE flagged_reviews
      SET admin_hidden_at = NOW(),
          admin_hidden_by = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, review_id, status, admin_hidden_at
    `,
    [flagId, adminId || null]
  );
  return result.rows[0] || null;
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

const getRestaurantsWithHealthCertificates = async () => {
  const result = await pool.query(
    `SELECT r.id, r.name, r.cuisine, r.address, r.certificate_verified,
            r.health_certificate_url, r.health_certificate_name,
            r.updated_at,
            u.full_name AS owner_name, u.email AS owner_email
     FROM restaurants r
     LEFT JOIN users u ON u.id = r.owner_id
     WHERE r.approval_status = 'approved'
       AND r.health_certificate_url IS NOT NULL
       AND r.health_certificate_url != ''
     ORDER BY r.certificate_verified ASC, r.updated_at DESC`
  );
  return result.rows;
};

const verifyRestaurant = async (restaurantId) => {
  const result = await pool.query(
    `UPDATE restaurants SET certificate_verified = true, updated_at = NOW()
     WHERE id = $1 RETURNING id, name, certificate_verified`,
    [restaurantId]
  );
  return result.rows[0] || null;
};

const unverifyRestaurant = async (restaurantId) => {
  const result = await pool.query(
    `UPDATE restaurants SET certificate_verified = false, updated_at = NOW()
     WHERE id = $1 RETURNING id, name, certificate_verified`,
    [restaurantId]
  );
  return result.rows[0] || null;
};

const getReviewDetailsForModerationEmail = async (reviewId) => {
  const result = await pool.query(
    `
      SELECT
        rv.comment,
        u.email AS user_email,
        u.full_name AS user_name,
        r.name AS restaurant_name
      FROM reviews rv
      JOIN users u ON u.id = rv.user_id
      JOIN restaurants r ON r.id = rv.restaurant_id
      WHERE rv.id = $1
    `,
    [reviewId]
  );

  return result.rows[0] || null;
};

const getReviewDetailsForModerationEmailByFlagId = async (flagId) => {
  const result = await pool.query(
    `
      SELECT
        fr.id AS flag_id,
        rv.id AS review_id,
        rv.comment,
        u.email AS user_email,
        u.full_name AS user_name,
        r.name AS restaurant_name
      FROM flagged_reviews fr
      JOIN reviews rv ON rv.id = fr.review_id
      JOIN users u ON u.id = rv.user_id
      JOIN restaurants r ON r.id = rv.restaurant_id
      WHERE fr.id = $1
      LIMIT 1
    `,
    [flagId]
  );

  return result.rows[0] || null;
};

const getBulkReviewDetailsForModerationEmail = async (reviewIds) => {
  if (!Array.isArray(reviewIds) || reviewIds.length === 0) return [];
  
  const result = await pool.query(
    `
      SELECT
        rv.id AS review_id,
        rv.comment,
        u.email AS user_email,
        u.full_name AS user_name,
        r.name AS restaurant_name
      FROM reviews rv
      JOIN users u ON u.id = rv.user_id
      JOIN restaurants r ON r.id = rv.restaurant_id
      WHERE rv.id = ANY($1)
    `,
    [reviewIds]
  );

  return result.rows;
};

const getBulkReviewDetailsForModerationEmailByFlagIds = async (flagIds) => {
  if (!Array.isArray(flagIds) || flagIds.length === 0) return [];

  const normalizedFlagIds = Array.from(
    new Set(
      flagIds
        .map((id) => parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
  if (!normalizedFlagIds.length) return [];

  const result = await pool.query(
    `
      SELECT
        fr.id AS flag_id,
        rv.id AS review_id,
        rv.comment,
        u.email AS user_email,
        u.full_name AS user_name,
        r.name AS restaurant_name
      FROM flagged_reviews fr
      JOIN reviews rv ON rv.id = fr.review_id
      JOIN users u ON u.id = rv.user_id
      JOIN restaurants r ON r.id = rv.restaurant_id
      WHERE fr.id = ANY($1::int[])
    `,
    [normalizedFlagIds]
  );

  return result.rows;
};

const getRestaurantIdByReviewId = async (reviewId) => {
  const result = await pool.query(
    `SELECT restaurant_id FROM reviews WHERE id = $1 LIMIT 1`,
    [reviewId]
  );
  return result.rows[0]?.restaurant_id || null;
};

const getRestaurantIdsByReviewIds = async (reviewIds) => {
  if (!Array.isArray(reviewIds) || reviewIds.length === 0) return new Map();

  const normalizedReviewIds = Array.from(
    new Set(
      reviewIds
        .map((id) => parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
  if (!normalizedReviewIds.length) return new Map();

  const result = await pool.query(
    `
      SELECT id AS review_id, restaurant_id
      FROM reviews
      WHERE id = ANY($1::int[])
    `,
    [normalizedReviewIds]
  );

  return new Map(
    result.rows.map((row) => [parseInt(row.review_id, 10), parseInt(row.restaurant_id, 10)])
  );
};

const recalculateRestaurantRating = async (restaurantId) => {
  const result = await pool.query(
    `
      WITH computed AS (
        SELECT COALESCE(ROUND(AVG(rv.rating)::numeric, 2), 0) AS avg_rating
        FROM reviews rv
        WHERE rv.restaurant_id = $1
          AND NOT EXISTS (
            SELECT 1
            FROM flagged_reviews fr
            WHERE fr.review_id = rv.id
              AND (
                (
                  fr.status = 'pending'
                  AND COALESCE(fr.suggested_action, 'REQUIRES_REVIEW') = 'REQUIRES_REVIEW'
                )
                OR (
                  fr.status = 'resolved'
                  AND fr.moderator_action = 'REQUIRE_CHANGES'
                  AND COALESCE(fr.resolved_at, fr.updated_at, fr.created_at) >= COALESCE(rv.updated_at, rv.created_at)
                )
              )
          )
      )
      UPDATE restaurants r
      SET rating = computed.avg_rating,
          updated_at = NOW()
      FROM computed
      WHERE r.id = $1
      RETURNING r.id, r.rating
    `,
    [restaurantId]
  );

  return result.rows[0] || null;
};

const getExportData = async () => {
  const [overview, users, restaurants, reservations, reviews, topSearches, dailyActivity] = await Promise.all([
    // 1. Platform overview
    pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (SELECT COUNT(*)::int FROM users WHERE is_suspended = true) AS suspended_users,
        (SELECT COUNT(*)::int FROM restaurants) AS total_restaurants,
        (SELECT COUNT(*)::int FROM restaurants WHERE approval_status = 'approved') AS approved_restaurants,
        (SELECT COUNT(*)::int FROM restaurants WHERE approval_status = 'pending') AS pending_restaurants,
        (SELECT COUNT(*)::int FROM reservations) AS total_reservations,
        (SELECT COUNT(*)::int FROM reservations WHERE status IN ('accepted','confirmed')) AS confirmed_reservations,
        (SELECT COUNT(*)::int FROM reservations WHERE status = 'cancelled') AS cancelled_reservations,
        (SELECT COUNT(*)::int FROM reviews) AS total_reviews,
        (SELECT COUNT(*)::int FROM flagged_reviews WHERE admin_hidden_at IS NULL) AS total_flagged_reviews,
        (SELECT COUNT(*)::int FROM flagged_reviews WHERE status = 'pending' AND admin_hidden_at IS NULL) AS pending_flags,
        (SELECT ROUND(AVG(rating)::numeric, 2) FROM restaurants WHERE approval_status = 'approved') AS avg_restaurant_rating
    `),

    // 2. Users
    pool.query(`
      SELECT
        u.id,
        u.full_name AS name,
        u.email,
        r.name AS role,
        u.is_suspended AS suspended,
        u.created_at AS joined_at,
        COUNT(DISTINCT res.id)::int AS reservation_count,
        COUNT(DISTINCT rev.id)::int AS review_count
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN reservations res ON res.user_id = u.id
      LEFT JOIN reviews rev ON rev.user_id = u.id
      GROUP BY u.id, u.full_name, u.email, r.name, u.is_suspended, u.created_at
      ORDER BY u.created_at DESC
    `),

    // 3. Restaurants
    pool.query(`
      SELECT
        r.id,
        r.name,
        r.cuisine,
        u.full_name AS owner_name,
        u.email AS owner_email,
        r.approval_status,
        r.address,
        r.phone,
        ROUND(r.rating::numeric, 2) AS rating,
        COUNT(DISTINCT rev.id)::int AS review_count,
        COUNT(DISTINCT res.id)::int AS reservation_count,
        r.created_at
      FROM restaurants r
      LEFT JOIN users u ON u.id = r.owner_id
      LEFT JOIN reviews rev ON rev.restaurant_id = r.id
      LEFT JOIN reservations res ON res.restaurant_id = r.id
      GROUP BY r.id, r.name, r.cuisine, u.full_name, u.email, r.approval_status, r.address, r.phone, r.rating, r.created_at
      ORDER BY r.created_at DESC
    `),

    // 4. Reservations
    pool.query(`
      SELECT
        res.id,
        rest.name AS restaurant_name,
        u.full_name AS user_name,
        u.email AS user_email,
        res.reservation_date,
        res.reservation_time,
        res.party_size,
        res.status,
        res.created_at
      FROM reservations res
      JOIN restaurants rest ON rest.id = res.restaurant_id
      JOIN users u ON u.id = res.user_id
      ORDER BY res.reservation_date DESC, res.reservation_time DESC
    `),

    // 5. Reviews
    pool.query(`
      SELECT
        rv.id,
        rest.name AS restaurant_name,
        u.full_name AS reviewer_name,
        u.email AS reviewer_email,
        rv.rating AS stars,
        LEFT(rv.comment, 200) AS comment_preview,
        CASE WHEN fr.id IS NOT NULL THEN 'Yes' ELSE 'No' END AS flagged,
        rv.created_at
      FROM reviews rv
      JOIN restaurants rest ON rest.id = rv.restaurant_id
      JOIN users u ON u.id = rv.user_id
      LEFT JOIN flagged_reviews fr ON fr.review_id = rv.id
      ORDER BY rv.created_at DESC
    `),

    // 6. Top searches
    pool.query(`
      SELECT
        query,
        COUNT(*)::int AS search_count,
        MAX(searched_at) AS last_searched
      FROM search_history
      GROUP BY query
      ORDER BY search_count DESC
      LIMIT 50
    `).catch(() => ({ rows: [] })),

    // 7. Daily activity (last 30 days)
    pool.query(`
      SELECT
        day::date AS date,
        COALESCE(new_users, 0)::int AS new_users,
        COALESCE(new_reservations, 0)::int AS new_reservations,
        COALESCE(new_reviews, 0)::int AS new_reviews
      FROM generate_series(
        CURRENT_DATE - INTERVAL '29 days',
        CURRENT_DATE,
        INTERVAL '1 day'
      ) AS day
      LEFT JOIN (
        SELECT DATE(created_at) AS d, COUNT(*)::int AS new_users FROM users GROUP BY d
      ) u ON u.d = day::date
      LEFT JOIN (
        SELECT DATE(created_at) AS d, COUNT(*)::int AS new_reservations FROM reservations GROUP BY d
      ) res ON res.d = day::date
      LEFT JOIN (
        SELECT DATE(created_at) AS d, COUNT(*)::int AS new_reviews FROM reviews GROUP BY d
      ) rev ON rev.d = day::date
      ORDER BY day ASC
    `),
  ]);

  return {
    overview: overview.rows[0],
    users: users.rows,
    restaurants: restaurants.rows,
    reservations: reservations.rows,
    reviews: reviews.rows,
    topSearches: topSearches.rows,
    dailyActivity: dailyActivity.rows,
  };
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
  unbanUser,
  deleteUserAndOwnedData,
  getFlaggedReviews,
  hideFlaggedReviewForAdmin,
  applyModerationActionByFlagId,
  bulkApplyModerationAction,
  dismissFlaggedReview,
  deleteReviewByFlagId,
  insertAuditLog,
  getSubscribedUsersByPreference,
  getExportData,
  getReviewDetailsForModerationEmail,
  getReviewDetailsForModerationEmailByFlagId,
  getBulkReviewDetailsForModerationEmail,
  getBulkReviewDetailsForModerationEmailByFlagIds,
  getRestaurantIdByReviewId,
  getRestaurantIdsByReviewIds,
  recalculateRestaurantRating,
  getRestaurantsWithHealthCertificates,
  verifyRestaurant,
  unverifyRestaurant,
};

