-- Install zhparser extension for Chinese full-text search
-- This script runs on database initialization (docker-entrypoint-initdb.d)

-- Install extension (requires zhparser to be compiled in the image)
CREATE EXTENSION IF NOT EXISTS zhparser;

-- Create Chinese text search configuration
CREATE TEXT SEARCH CONFIGURATION chinese (PARSER = zhparser);
ALTER TEXT SEARCH CONFIGURATION chinese ADD MAPPING FOR n,v,a,i,e,l WITH simple;
