CREATE TABLE abby_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  api_key text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO abby_settings (id) VALUES (1);
