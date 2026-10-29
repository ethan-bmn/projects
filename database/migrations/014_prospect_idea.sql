ALTER TABLE prospects ADD COLUMN idea text NOT NULL DEFAULT ''
  CHECK (char_length(idea) <= 5000);
