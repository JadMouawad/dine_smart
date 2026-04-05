CREATE TABLE IF NOT EXISTS subscription_notifications (
  id SERIAL PRIMARY KEY,
  update_type VARCHAR(20) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscription_notifications_type_check CHECK (update_type IN ('news', 'offers', 'events')),
  CONSTRAINT subscription_notifications_unique UNIQUE (update_type, entity_type, entity_id, fingerprint)
);
