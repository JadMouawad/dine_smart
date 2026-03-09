-- Sprint 3 Phase 3 (Admin Governance)
-- - User suspension support
-- - Admin audit logging

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id
  ON admin_audit_logs(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON admin_audit_logs(created_at DESC);

