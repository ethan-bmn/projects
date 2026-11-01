ALTER TABLE projects ALTER COLUMN specification DROP NOT NULL;
ALTER TABLE projects ADD COLUMN quote_id text CHECK (length(trim(quote_id)) BETWEEN 1 AND 200);
