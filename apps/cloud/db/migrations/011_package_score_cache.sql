-- Cached on-demand package scores (static + live tiers)

CREATE TABLE IF NOT EXISTS package_score_cache (
  package_name TEXT NOT NULL,
  version TEXT NOT NULL,
  scan_tier TEXT NOT NULL CHECK (scan_tier IN ('static', 'live')),
  score INTEGER NOT NULL,
  level TEXT NOT NULL,
  grade TEXT NOT NULL,
  score_report JSONB NOT NULL,
  checks JSONB NOT NULL DEFAULT '[]',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (package_name, version, scan_tier)
);

CREATE INDEX IF NOT EXISTS idx_pkg_score_lookup ON package_score_cache (package_name, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_pkg_score_recent ON package_score_cache (computed_at DESC);
