-- Rollback for 002_api_key_scopes.sql
-- Apply manually when reverting a deploy: psql $DATABASE_URL -f db/migrations/002_api_key_scopes.down.sql

ALTER TABLE api_keys DROP COLUMN IF EXISTS scopes;
