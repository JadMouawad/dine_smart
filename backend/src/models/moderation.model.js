async function getRestaurantModerationPolicy(db, restaurantId) {
  const query = `
    SELECT restaurant_id, ai_enabled, fallback_to_rules, policy_json
    FROM restaurant_moderation_policies
    WHERE restaurant_id = $1
    LIMIT 1;
  `;

  try {
    const result = await db.query(query, [restaurantId]);
    return result.rows[0] || null;
  } catch (error) {
    // Keep backward compatibility if migration was not applied yet.
    if (error.code === "42P01") {
      return null;
    }
    throw error;
  }
}

async function resolvePendingSystemFlagsForReview(db, reviewId, note = null) {
  const query = `
    UPDATE flagged_reviews
    SET status = 'resolved',
        admin_notes = COALESCE($2, admin_notes),
        resolved_at = NOW(),
        updated_at = NOW()
    WHERE review_id = $1
      AND source_type IN ('SYSTEM_AI', 'SYSTEM_RULE')
      AND status = 'pending'
    RETURNING id;
  `;

  try {
    return await db.query(query, [reviewId, note]);
  } catch (error) {
    if (error.code === "42703" || error.code === "42P01") {
      return { rows: [] };
    }
    throw error;
  }
}

async function createFlaggedReview(db, payload) {
  const {
    reviewId,
    userId = null,
    reason,
    sourceType,
    flagType = null,
    confidence = null,
    severity = null,
    snippet = null,
    suggestedAction = null,
    moderationMetadata = null,
    status = "pending",
  } = payload;

  const query = `
    INSERT INTO flagged_reviews (
      review_id,
      user_id,
      reason,
      status,
      source_type,
      flag_type,
      confidence,
      severity,
      snippet,
      suggested_action,
      moderation_metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
    RETURNING id, review_id, user_id, reason, status, source_type, flag_type, confidence, severity, snippet, suggested_action, moderation_metadata, created_at;
  `;

  const values = [
    reviewId,
    userId,
    reason,
    status,
    sourceType,
    flagType,
    confidence,
    severity,
    snippet,
    suggestedAction,
    moderationMetadata ? JSON.stringify(moderationMetadata) : null,
  ];

  try {
    return await db.query(query, values);
  } catch (error) {
    if (error.code === "42703") {
      // Fallback to legacy schema fields.
      const legacyQuery = `
        INSERT INTO flagged_reviews (review_id, user_id, reason, status)
        VALUES ($1, $2, $3, $4)
        RETURNING id, review_id, user_id, reason, status, created_at;
      `;
      return db.query(legacyQuery, [reviewId, userId, reason, status]);
    }
    throw error;
  }
}

module.exports = {
  getRestaurantModerationPolicy,
  resolvePendingSystemFlagsForReview,
  createFlaggedReview,
};
