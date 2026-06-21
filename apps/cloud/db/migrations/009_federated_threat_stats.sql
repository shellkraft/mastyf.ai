-- Federated threat radar stats from opt-in instance heartbeats (no raw payloads)

CREATE TABLE IF NOT EXISTS "mastyf-ai_federated_threat_stats" (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  region TEXT,
  attack_class_counts JSONB NOT NULL DEFAULT '{}',
  rule_efficacy JSONB NOT NULL DEFAULT '[]',
  threshold_recommendation JSONB NOT NULL DEFAULT '{}',
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, instance_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_federated_threat_org ON "mastyf-ai_federated_threat_stats" (org_id, last_seen DESC);
