ALTER TABLE projects ADD COLUMN contract jsonb
  CHECK (contract IS NULL OR jsonb_typeof(contract) = 'object');
