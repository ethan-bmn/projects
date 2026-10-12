-- Preserve an existing owner account while aligning fresh databases with auth.
DO $$
BEGIN
  IF to_regclass('"user"') IS NULL THEN
    ALTER TABLE users RENAME TO "user";
  END IF;
END;
$$;
