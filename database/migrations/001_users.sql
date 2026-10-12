CREATE TABLE users (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  email text NOT NULL CHECK (
    email = lower(trim(email)) AND length(email) BETWEEN 3 AND 254
  ),
  password_hash text NOT NULL CHECK (length(password_hash) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
