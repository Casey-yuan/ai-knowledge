#!/bin/sh
set -e

echo "[startup] Running Prisma db push..."
npx prisma db push --skip-generate

echo "[startup] Running database fixes..."
psql "$DATABASE_URL" -c "
  DO \$\$
  DECLARE
    col_typname text;
  BEGIN
    -- Check Chunk.embedding column type
    SELECT t.typname INTO col_typname
    FROM pg_attribute a
    JOIN pg_type t ON a.atttypid = t.oid
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relname = 'Chunk' AND a.attname = 'embedding' AND n.nspname = 'public';

    -- Only fix if column exists and is NOT vector(1024)
    IF col_typname IS NOT NULL THEN
      -- Check the actual dimension by looking at pg_type typtypmod
      -- If the column type is 'vector' but dimension differs, fix it
      PERFORM 1
      FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE c.relname = 'Chunk' AND a.attname = 'embedding'
        AND a.atttypmod != 1024 + 4;  -- pgvector stores dim + 4 as typmod

      IF FOUND THEN
        RAISE NOTICE 'Chunk.embedding: fixing dimension to 1024...';
        ALTER TABLE \"Chunk\" DROP COLUMN embedding;
        ALTER TABLE \"Chunk\" ADD COLUMN embedding vector(1024);
        RAISE NOTICE 'Chunk.embedding: (re)created as vector(1024)';
      ELSE
        RAISE NOTICE 'Chunk.embedding: already vector(1024), no fix needed';
      END IF;
    END IF;

    -- Try to set up zhparser for Chinese full-text search
    BEGIN
      CREATE EXTENSION IF NOT EXISTS zhparser;
      IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'chinese') THEN
        CREATE TEXT SEARCH CONFIGURATION chinese (PARSER = zhparser);
        ALTER TEXT SEARCH CONFIGURATION chinese ADD MAPPING FOR n,v,a,i,e,l WITH simple;
      END IF;
      RAISE NOTICE 'zhparser: Chinese text search configuration ready';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'zhparser: not available, full-text search will use simple parser';
    END;
  END
  \$\$;
" 2>&1 || echo "[startup] Warning: some database fixes were skipped"

echo "[startup] Starting application..."
exec node dist/main
