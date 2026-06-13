-- Anonymized fleet threat signatures aggregated from instance heartbeats

CREATE TABLE IF NOT EXISTS mastyff_ai_fleet_threat_signatures (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signature_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  region TEXT,
  rule_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'unknown',
  arg_shape_hash TEXT NOT NULL DEFAULT '',
  event_count INTEGER NOT NULL DEFAULT 1,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, signature_id, instance_id)
);

CREATE INDEX IF NOT EXISTS idx_fleet_threat_org_sig ON mastyff_ai_fleet_threat_signatures (org_id, signature_id, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_threat_region ON mastyff_ai_fleet_threat_signatures (org_id, region, last_seen DESC);
