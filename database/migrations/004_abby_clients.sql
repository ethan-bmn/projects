-- Abby business clients have organization IDs, distinct from person IDs.
-- Start a fresh import rather than relabeling existing people as companies.
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  abby_id text NOT NULL UNIQUE,
  name text NOT NULL,
  commercial_name text,
  emails text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX clients_name_idx ON clients (active, name, id);

DROP TABLE contacts;

ALTER TABLE abby_sync_state RENAME COLUMN contact_count TO client_count;
UPDATE abby_sync_state SET last_attempt_at = NULL, last_success_at = NULL,
  last_error = NULL, client_count = 0 WHERE id = 1;
