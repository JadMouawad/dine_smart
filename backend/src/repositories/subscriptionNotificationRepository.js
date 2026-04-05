const pool = require("../config/db");

const recordNotification = async ({ updateType, entityType, entityId, fingerprint }) => {
  const result = await pool.query(
    `
      INSERT INTO subscription_notifications (update_type, entity_type, entity_id, fingerprint)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (update_type, entity_type, entity_id, fingerprint) DO NOTHING
      RETURNING id
    `,
    [updateType, entityType, entityId, fingerprint]
  );
  return result.rowCount > 0;
};

module.exports = {
  recordNotification,
};
