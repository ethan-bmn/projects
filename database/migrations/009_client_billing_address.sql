ALTER TABLE clients ADD COLUMN billing_address jsonb
  CHECK (billing_address IS NULL OR jsonb_typeof(billing_address) = 'object');

-- Refresh existing clients with their address on the next automatic import.
UPDATE abby_sync_state SET last_attempt_at = NULL, last_success_at = NULL WHERE id = 1;
