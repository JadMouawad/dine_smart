const pool = require("../config/db");

const awardPointsForSource = async (
  { userId, sourceType, sourceId, points },
  db = pool
) => {
  const query = `
    WITH inserted AS (
      INSERT INTO user_points_ledger (user_id, source_type, source_id, points)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
      RETURNING points
    )
    UPDATE users
    SET points = points + COALESCE((SELECT points FROM inserted), 0),
        updated_at = NOW()
    WHERE id = $1
    RETURNING points,
      COALESCE((SELECT points FROM inserted), 0) AS awarded_points
  `;
  const result = await db.query(query, [userId, sourceType, sourceId, points]);
  return result.rows[0] || { points: 0, awarded_points: 0 };
};

const getUserPoints = async (userId, db = pool) => {
  const result = await db.query(
    "SELECT points FROM users WHERE id = $1",
    [userId]
  );
  return result.rows[0]?.points ?? 0;
};

const getRewardByCode = async ({ userId, rewardCode }, db = pool) => {
  const result = await db.query(
    `
      SELECT id, reward_code, points_spent, redeemed_at
      FROM user_rewards
      WHERE user_id = $1 AND reward_code = $2
    `,
    [userId, rewardCode]
  );
  return result.rows[0] || null;
};

const redeemReward = async (
  { userId, rewardCode, pointsCost },
  db = pool
) => {
  const query = `
    WITH updated AS (
      UPDATE users
      SET points = points - $3,
          updated_at = NOW()
      WHERE id = $1 AND points >= $3
      RETURNING points
    ),
    inserted AS (
      INSERT INTO user_rewards (user_id, reward_code, points_spent)
      SELECT $1, $2, $3
      WHERE EXISTS (SELECT 1 FROM updated)
      ON CONFLICT DO NOTHING
      RETURNING id
    ),
    ledger AS (
      INSERT INTO user_points_ledger (user_id, source_type, source_id, points)
      SELECT $1, 'reward_redeem', COALESCE((SELECT id FROM inserted), 0), -$3
      WHERE EXISTS (SELECT 1 FROM inserted)
      ON CONFLICT DO NOTHING
    )
    SELECT
      EXISTS (SELECT 1 FROM inserted) AS redeemed,
      (SELECT points FROM updated) AS points
  `;
  const result = await db.query(query, [userId, rewardCode, pointsCost]);
  return result.rows[0] || { redeemed: false, points: null };
};

module.exports = {
  awardPointsForSource,
  getUserPoints,
  getRewardByCode,
  redeemReward,
};
