-- Ensure zhparser Chinese text search config exists
-- Safe to run multiple times (idempotent)

DO $$
BEGIN
  -- Install extension if not present
  CREATE EXTENSION IF NOT EXISTS zhparser;

  -- Create Chinese text search configuration if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_ts_config WHERE cfgname = 'chinese'
  ) THEN
    CREATE TEXT SEARCH CONFIGURATION chinese (PARSER = zhparser);
    ALTER TEXT SEARCH CONFIGURATION chinese ADD MAPPING FOR n,v,a,i,e,l WITH simple;
  END IF;
END
$$;
