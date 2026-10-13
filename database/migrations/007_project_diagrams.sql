ALTER TABLE projects ADD COLUMN diagrams jsonb NOT NULL
  DEFAULT '{"database":null,"wbs":[]}'::jsonb
  CHECK (jsonb_typeof(diagrams) = 'object');
