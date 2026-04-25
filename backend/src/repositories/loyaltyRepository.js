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

const reversePointsForSource = async (
  { userId, sourceType, reversalSourceType, sourceId, points },
  db = pool
) => {
  const query = `
    WITH original AS (
      SELECT 1
      FROM user_points_ledger
      WHERE user_id = $1
        AND source_type = $2::varchar(20)
        AND source_id = $3
        AND points > 0
      LIMIT 1
    ),
    inserted AS (
      INSERT INTO user_points_ledger (user_id, source_type, source_id, points)
      SELECT $1, $4::varchar(20), $3, -($5::int)
      WHERE EXISTS (SELECT 1 FROM original)
        AND NOT EXISTS (
          SELECT 1
          FROM user_points_ledger
          WHERE user_id = $1
            AND source_type = $4::varchar(20)
            AND source_id = $3
        )
      RETURNING points
    )
    UPDATE users
    SET points = points + COALESCE((SELECT points FROM inserted), 0),
        updated_at = NOW()
    WHERE id = $1
    RETURNING points,
      COALESCE((SELECT ABS(points) FROM inserted), 0) AS reversed_points
  `;
  const result = await db.query(query, [userId, sourceType, sourceId, reversalSourceType, points]);
  return result.rows[0] || { points: 0, reversed_points: 0 };
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

const deductPointsForReward = async (
  { userId, sourceId, points },
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
    ledger AS (
      INSERT INTO user_points_ledger (user_id, source_type, source_id, points)
      SELECT $1, 'reward_redeem', $2, -$3
      WHERE EXISTS (SELECT 1 FROM updated)
      ON CONFLICT DO NOTHING
    )
    SELECT (SELECT points FROM updated) AS points
  `;
  const result = await db.query(query, [userId, sourceId, points]);
  return result.rows[0] || { points: null };
};

module.exports = {
  awardPointsForSource,
  reversePointsForSource,
  getUserPoints,
  getRewardByCode,
  redeemReward,
  deductPointsForReward,
};
