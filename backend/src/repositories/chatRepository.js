const pool = require("../config/db");
const profileRepository = require("./profileRepository");

let schemaEnsured = false;

const ensureSchema = async () => {
  if (schemaEnsured) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_conversation_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_message TEXT NOT NULL,
      assistant_response TEXT NOT NULL,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      model_provider VARCHAR(80) NOT NULL,
      model_name VARCHAR(120) NOT NULL,
      request_context JSONB,
      response_metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_ai_conversation_logs_created_at
    ON ai_conversation_logs(created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_ai_conversation_logs_user_id
    ON ai_conversation_logs(user_id)
  `);

  schemaEnsured = true;
};

const createConversationLog = async ({
  userId,
  userMessage,
  assistantResponse,
  latencyMs,
  modelProvider,
  modelName,
  requestContext = null,
  responseMetadata = null,
}) => {
  await ensureSchema();

  const result = await pool.query(
    `
      INSERT INTO ai_conversation_logs (
        user_id,
        user_message,
        assistant_response,
        latency_ms,
        model_provider,
        model_name,
        request_context,
        response_metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
      RETURNING id, user_id, created_at, latency_ms, model_provider, model_name
    `,
    [
      userId || null,
      userMessage,
      assistantResponse,
      latencyMs,
      modelProvider,
      modelName,
      requestContext ? JSON.stringify(requestContext) : null,
      responseMetadata ? JSON.stringify(responseMetadata) : null,
    ]
  );

  return result.rows[0] || null;
};

const getRecentConversationLogs = async (limit = 20) => {
  await ensureSchema();

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const result = await pool.query(
    `
      SELECT
        l.id,
        l.user_id,
        u.full_name,
        u.email,
        l.user_message,
        l.assistant_response,
        l.latency_ms,
        l.model_provider,
        l.model_name,
        l.request_context,
        l.response_metadata,
        l.created_at
      FROM ai_conversation_logs l
      LEFT JOIN users u ON u.id = l.user_id
      ORDER BY l.created_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
};

const getUserContext = async (userId) => {
  const profile = await profileRepository.getById(userId);
  if (!profile) return null;

  const [reservationCount, recentReviews] = await Promise.all([
    profileRepository.getReservationCountByUserId(userId),
    profileRepository.getReviewsByUserId(userId),
  ]);

  const preferredCuisines = recentReviews
    .map((review) => review.restaurant_name || "")
    .filter(Boolean)
    .slice(0, 3);

  return {
    profile,
    reservationCount,
    recentReviews: recentReviews.slice(0, 5),
    preferredCuisines,
  };
};

module.exports = {
  ensureSchema,
  createConversationLog,
  getRecentConversationLogs,
  getUserContext,
};