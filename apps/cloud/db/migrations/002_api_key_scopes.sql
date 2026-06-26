ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes TEXT NOT NULL DEFAULT '["badge:read","policy:read"]';
