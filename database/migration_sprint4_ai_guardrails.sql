CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(80) PRIMARY KEY,
  value_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO app_settings (key, value_json)
VALUES ('ai_chat_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
