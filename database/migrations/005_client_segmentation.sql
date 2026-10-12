-- Existing rows are Abby organizations; preserve their local UUIDs.
ALTER TABLE clients ADD COLUMN kind text NOT NULL DEFAULT 'organization'
  CHECK (kind IN ('organization', 'individual'));
ALTER TABLE clients DROP CONSTRAINT clients_abby_id_key;
ALTER TABLE clients ADD CONSTRAINT clients_kind_abby_id_key UNIQUE (kind, abby_id);
CREATE INDEX clients_kind_name_idx ON clients (active, kind, name, id);

-- Make the expanded import due without deleting existing clients.
UPDATE abby_sync_state SET last_attempt_at = NULL, last_success_at = NULL,
  last_error = NULL WHERE id = 1;
