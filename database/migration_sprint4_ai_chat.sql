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
);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_logs_created_at
  ON ai_conversation_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_logs_user_id
  ON ai_conversation_logs(user_id);
