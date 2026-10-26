CREATE TABLE prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  email text NOT NULL DEFAULT '' CHECK (char_length(email) <= 254),
  phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 50),
  domain text NOT NULL CHECK (char_length(btrim(domain)) BETWEEN 1 AND 200),
  website_url text CHECK (char_length(website_url) <= 2048 AND website_url ~* '^https?://'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(email) <> '' OR btrim(phone) <> '')
);

CREATE INDEX prospects_name_id_idx ON prospects (name, id);
