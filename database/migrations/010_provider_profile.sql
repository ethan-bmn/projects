CREATE TABLE provider_profile (
  id integer PRIMARY KEY CHECK (id = 1),
  name text NOT NULL,
  siren text NOT NULL,
  address text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO provider_profile (id, name, siren, address, email, phone)
VALUES (1, 'Ethan BAUMANN EI', '130584659', '248 rue André Philip, 69003 Lyon', 'contact@ethanbaumann.fr', '+33667739428')
ON CONFLICT (id) DO NOTHING;
