-- Review moderation enhancement
-- Adds AI/rule-based moderation metadata, source attribution, and restaurant policy config.

ALTER TABLE flagged_reviews
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE flagged_reviews
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'USER_REPORT',
  ADD COLUMN IF NOT EXISTS flag_type VARCHAR(40),
  ADD COLUMN IF NOT EXISTS confidence SMALLINT,
  ADD COLUMN IF NOT EXISTS severity VARCHAR(20),
  ADD COLUMN IF NOT EXISTS snippet TEXT,
  ADD COLUMN IF NOT EXISTS suggested_action VARCHAR(30) DEFAULT 'REQUIRES_REVIEW',
  ADD COLUMN IF NOT EXISTS moderation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS moderator_action VARCHAR(30),
  ADD COLUMN IF NOT EXISTS resolution_label VARCHAR(30),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flagged_reviews_review_user_unique'
  ) THEN
    ALTER TABLE flagged_reviews DROP CONSTRAINT flagged_reviews_review_user_unique;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_flagged_reviews_review_user_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_flagged_reviews_review_user_report_unique
  ON flagged_reviews(review_id, user_id)
  WHERE source_type = 'USER_REPORT' AND user_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flagged_reviews_source_type_check'
  ) THEN
    ALTER TABLE flagged_reviews
      ADD CONSTRAINT flagged_reviews_source_type_check
      CHECK (source_type IN ('USER_REPORT', 'SYSTEM_AI', 'SYSTEM_RULE'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flagged_reviews_flag_type_check'
  ) THEN
    ALTER TABLE flagged_reviews
      ADD CONSTRAINT flagged_reviews_flag_type_check
      CHECK (
        flag_type IS NULL OR
        flag_type IN ('PROFANITY', 'HARASSMENT', 'SPAM', 'FAKE_REVIEW', 'MISLEADING', 'INAPPROPRIATE_CONTENT')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flagged_reviews_confidence_check'
  ) THEN
    ALTER TABLE flagged_reviews
      ADD CONSTRAINT flagged_reviews_confidence_check
      CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flagged_reviews_severity_check'
  ) THEN
    ALTER TABLE flagged_reviews
      ADD CONSTRAINT flagged_reviews_severity_check
      CHECK (severity IS NULL OR severity IN ('HIGH', 'MEDIUM', 'LOW'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flagged_reviews_suggested_action_check'
  ) THEN
    ALTER TABLE flagged_reviews
      ADD CONSTRAINT flagged_reviews_suggested_action_check
      CHECK (
        suggested_action IS NULL OR
        suggested_action IN ('REQUIRES_REVIEW', 'SOFT_FLAG', 'INFORMATION_ONLY')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flagged_reviews_moderator_action_check'
  ) THEN
    ALTER TABLE flagged_reviews
      ADD CONSTRAINT flagged_reviews_moderator_action_check
      CHECK (
        moderator_action IS NULL OR
        moderator_action IN ('APPROVE_PUBLISH', 'REQUIRE_CHANGES', 'DELETE', 'DISMISS')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flagged_reviews_resolution_label_check'
  ) THEN
    ALTER TABLE flagged_reviews
      ADD CONSTRAINT flagged_reviews_resolution_label_check
      CHECK (resolution_label IS NULL OR resolution_label IN ('TRUE_POSITIVE', 'FALSE_POSITIVE'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_flagged_reviews_pending_action
  ON flagged_reviews(status, suggested_action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_flagged_reviews_source_type
  ON flagged_reviews(source_type);

CREATE TABLE IF NOT EXISTS restaurant_moderation_policies (
  restaurant_id INTEGER PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  fallback_to_rules BOOLEAN NOT NULL DEFAULT true,
  policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
