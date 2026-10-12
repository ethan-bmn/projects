CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  abby_id text NOT NULL UNIQUE,
  fullname text NOT NULL,
  emails text[] NOT NULL DEFAULT '{}',
  organization_id text,
  organization_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contacts_name_idx ON contacts (active, fullname, id);

CREATE TABLE abby_sync_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  contact_count integer NOT NULL DEFAULT 0
);

INSERT INTO abby_sync_state (id) VALUES (1);
