-- One-time tokens for cloud → Mastyf AI dashboard SSO launch

CREATE TABLE IF NOT EXISTS license_exchange_tokens (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  "mastyf-ai_url" TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_license_exchange_org ON license_exchange_tokens(org_id);
CREATE INDEX IF NOT EXISTS idx_license_exchange_expires ON license_exchange_tokens(expires_at);
