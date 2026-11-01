CREATE TABLE docusign_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  environment text NOT NULL DEFAULT 'demo' CHECK (environment IN ('demo', 'production')),
  integration_key text NOT NULL DEFAULT '',
  client_secret text NOT NULL DEFAULT '',
  redirect_uri text NOT NULL DEFAULT '',
  access_token text NOT NULL DEFAULT '',
  refresh_token text NOT NULL DEFAULT '',
  expires_at timestamptz,
  account_id text NOT NULL DEFAULT '',
  account_name text NOT NULL DEFAULT '',
  base_uri text NOT NULL DEFAULT '',
  oauth_state_hash text,
  oauth_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO docusign_settings (id) VALUES (1);
