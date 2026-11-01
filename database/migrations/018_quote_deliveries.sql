CREATE TABLE quote_deliveries (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  quote_id text NOT NULL,
  recipient text NOT NULL,
  recipient_name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  filename text NOT NULL,
  request_hash text NOT NULL,
  pdf bytea,
  status text NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'sending', 'sent', 'failed', 'uncertain')),
  signature_status text NOT NULL DEFAULT 'none' CHECK (signature_status IN ('none', 'pending', 'sending', 'sent', 'failed', 'uncertain')),
  envelope_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quote_deliveries_project_created_idx ON quote_deliveries (project_id, created_at DESC);
