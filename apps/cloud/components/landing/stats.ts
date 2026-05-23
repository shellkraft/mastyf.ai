export const NPM_PACKAGE_URL = 'https://www.npmjs.com/package/@mcp-guardian/server';

/** Headline metrics from README adversarial harness + enterprise sim (May 2026). */
export const HERO_STATS = [
  { value: '11k+', label: 'npm downloads / month', detail: '@mcp-guardian/server on npmjs.com' },
  { value: '154/154', label: 'Corpus attacks blocked', detail: '0 false positives on 74 benign fixtures' },
  { value: '84/85', label: 'Evasion probes blocked', detail: 'Encoding, unicode, SSRF, shell/SQL obfuscation' },
  { value: '93.3%', label: 'Enterprise sim block rate', detail: '308/330 modeled attacks · 38.8ms avg latency' },
  { value: '~41s', label: 'Instant learning discovery', detail: 'vs ~4.9h batch-only (repo eval)' },
  { value: '8.6/10', label: 'Production readiness', detail: 'Enterprise security assessment (May 2026)' },
  { value: '26/26', label: 'Live stdio integration', detail: 'Real mock MCP + proxy pipeline' },
] as const;

export const SWARM_AGENTS = [
  { name: 'Scout', track: 'CI', role: 'Discover tools, CVEs, policy gaps' },
  { name: 'Corpus', track: 'CI', role: '154-attack regression suite' },
  { name: 'Evasion', track: 'CI', role: '85 obfuscation probes' },
  { name: 'Parity', track: 'CI', role: 'Python ↔ TypeScript policy parity' },
  { name: 'BlockGuard', track: 'Runtime', role: 'Policy block on every tools/call' },
  { name: 'InstantLearner', track: 'Runtime', role: 'Rolling stats → attack-pattern suggestions' },
  { name: 'SemanticAuditor', track: 'Runtime', role: 'Tier-2 LLM semantic audit (Pro)' },
  { name: 'Calibrator', track: 'Runtime', role: 'Threshold tuning from labeled outcomes' },
] as const;

export const FEATURES = [
  {
    title: 'Transparent stdio proxy',
    body: 'Drop-in for Cursor, Cline, and Claude Code — enforce YAML policy on every MCP tools/call without changing agent code.',
  },
  {
    title: 'Three-layer detection',
    body: 'Regex triage (TR39 confusables) → Ajv schema validation → optional LLM semantic verdict with circuit breaker and local fallback.',
  },
  {
    title: 'Cost & health governance',
    body: 'Per-tenant token budgets, cost auditor, health monitors, and Grafana-ready SLO dashboards for production fleets.',
  },
  {
    title: 'Multi-tenant enterprise',
    body: 'JWT-bound tenants, Postgres RLS, DPoP, audit hash chain, mTLS hot-reload, and Helm enterprise overlay.',
  },
  {
    title: 'Live dashboard (Pro)',
    body: 'Browser SPA with WebSocket feed, policy editor, swarm reports, ThreatIntel polling, and SOC2-style access audit.',
  },
  {
    title: 'Open-core + cloud plane',
    body: 'MIT Community proxy and harness on npm; optional Pro license for swarm CLI, fleet, AI learning, and semantic async.',
  },
] as const;

export const EVIDENCE_ROWS = [
  { suite: 'Corpus (default-policy)', result: '154/154 blocked · 74/74 benign pass', trust: 'CI-gated' },
  { suite: 'Evasion probes', result: '84/85 blocked (adv-066 tracked)', trust: 'CI-gated' },
  { suite: 'Node live integration', result: '26/26 stdio proxy tests', trust: 'CI-gated' },
  { suite: 'Python ↔ TS parity', result: '400/402 (99.5%) · 0 corpus mismatches', trust: 'Offline mirror' },
  { suite: 'Enterprise 5-scenario sim', result: '330 attacks · 93.33% block · 0 FP', trust: 'Synthetic' },
  { suite: 'Attack learning (long eval)', result: '5003 blocks · instant 41s vs batch 4.9h', trust: 'Repo eval' },
] as const;
