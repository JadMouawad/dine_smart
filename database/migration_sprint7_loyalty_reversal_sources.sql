-- Allow loyalty reversal ledger entries for cancellations

ALTER TABLE user_points_ledger
  DROP CONSTRAINT IF EXISTS user_points_ledger_type_check;

ALTER TABLE user_points_ledger
  ADD CONSTRAINT user_points_ledger_type_check
  CHECK (source_type IN ('reservation', 'event', 'reward_redeem', 'reservation_cancel', 'event_cancel'));
