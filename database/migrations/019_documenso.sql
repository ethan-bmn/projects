CREATE TABLE documenso_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  api_token text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO documenso_settings (id) VALUES (1);

-- Preserve the provider of existing invitations, including pending requests.
ALTER TABLE quote_deliveries ADD COLUMN signature_provider text NOT NULL DEFAULT 'docusign'
  CHECK (signature_provider IN ('docusign', 'documenso'));
ALTER TABLE quote_deliveries ALTER COLUMN signature_provider SET DEFAULT 'documenso';
