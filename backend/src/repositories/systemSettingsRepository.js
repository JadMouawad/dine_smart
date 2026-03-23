const pool = require("../config/db");

let schemaEnsured = false;

const ensureSchema = async () => {
  if (schemaEnsured) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(80) PRIMARY KEY,
      value_json JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await pool.query(`
    INSERT INTO app_settings (key, value_json)
    VALUES ('ai_chat_enabled', '{"enabled": true}'::jsonb)
    ON CONFLICT (key) DO NOTHING
  `);

  schemaEnsured = true;
};

const getAiChatSetting = async () => {
  await ensureSchema();

  const result = await pool.query(
    `
      SELECT key, value_json, updated_at, updated_by
      FROM app_settings
      WHERE key = 'ai_chat_enabled'
      LIMIT 1
    `
  );

  const row = result.rows[0];
  const enabled = row?.value_json && typeof row.value_json.enabled === "boolean"
    ? row.value_json.enabled
    : true;

  return {
    enabled,
    updated_at: row?.updated_at || null,
    updated_by: row?.updated_by || null,
  };
};

const setAiChatSetting = async ({ enabled, updatedBy = null }) => {
  await ensureSchema();

  const result = await pool.query(
    `
      INSERT INTO app_settings (key, value_json, updated_by)
      VALUES ('ai_chat_enabled', $1::jsonb, $2)
      ON CONFLICT (key)
      DO UPDATE SET
        value_json = EXCLUDED.value_json,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING key, value_json, updated_at, updated_by
    `,
    [JSON.stringify({ enabled: Boolean(enabled) }), updatedBy]
  );

  const row = result.rows[0];

  return {
    enabled: Boolean(row?.value_json?.enabled),
    updated_at: row?.updated_at || null,
    updated_by: row?.updated_by || null,
  };
};

module.exports = {
  ensureSchema,
  getAiChatSetting,
  setAiChatSetting,
};
