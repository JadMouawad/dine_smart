const pool = require("../config/db");

const createVoucher = async (
  { userId, discountPercentage, uniqueCode, expirationDate },
  db = pool
) => {
  const result = await db.query(
    `
      INSERT INTO vouchers (user_id, discount_percentage, unique_code, expiration_date)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, discount_percentage, status, unique_code, expiration_date, created_at
    `,
    [userId, discountPercentage, uniqueCode, expirationDate]
  );
  return result.rows[0];
};

const getActiveVoucherByUser = async (
  { userId, discountPercentage = 10 },
  db = pool
) => {
  const result = await db.query(
    `
      SELECT id, user_id, discount_percentage, status, unique_code, expiration_date
      FROM vouchers
      WHERE user_id = $1
        AND status = 'ACTIVE'
        AND discount_percentage = $2
        AND expiration_date >= CURRENT_DATE
      LIMIT 1
    `,
    [userId, discountPercentage]
  );
  return result.rows[0] || null;
};

const getVoucherForUpdate = async (
  { userId, code },
  db = pool
) => {
  const result = await db.query(
    `
      SELECT id, user_id, discount_percentage, status, unique_code, expiration_date
      FROM vouchers
      WHERE user_id = $1 AND unique_code = $2
      FOR UPDATE
    `,
    [userId, code]
  );
  return result.rows[0] || null;
};

const markVoucherUsed = async ({ voucherId }, db = pool) => {
  const result = await db.query(
    `
      UPDATE vouchers
      SET status = 'USED', used_at = NOW()
      WHERE id = $1 AND status = 'ACTIVE'
      RETURNING id, status, used_at
    `,
    [voucherId]
  );
  return result.rows[0] || null;
};

module.exports = {
  createVoucher,
  getActiveVoucherByUser,
  getVoucherForUpdate,
  markVoucherUsed,
};
