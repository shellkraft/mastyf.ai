export const NPM_PACKAGE_URL = 'https://www.npmjs.com/package/@mastyff-ai/server';

/** Headline metrics from README adversarial harness + enterprise sim (May 2026). */
export const HERO_STATS = [
  { value: '557+', label: 'Adversarial fixtures', detail: 'Prompt injection, exfil, SSRF, shell obfuscation, chaining' },
  { value: '11k+', label: 'npm downloads / month', detail: '@mastyff-ai/server on npmjs.com' },
  { value: '154/154', label: 'Corpus attacks blocked', detail: '0 false positives on 74 benign fixtures' },
  { value: '93.3%', label: 'Enterprise sim block rate', detail: '308/330 modeled attacks · 38.8ms avg latency' },
  { value: '~41s', label: 'Instant learning discovery', detail: 'vs ~4.9h batch-only (repo eval)' },
  { value: '8.6/10', label: 'Production readiness', detail: 'Enterprise security assessment (May 2026)' },
] as const;

export const PROBLEM_BULLETS = [
  'AI agents connect to databases, GitHub, Slack, and internal APIs via MCP — with no security layer in between.',
  'Malicious tool responses inject instructions, exfiltrate credentials, and chain calls to bypass access controls.',
  'Security teams have zero visibility, no enforcement, and no audit trail for what agents actually do in production.',
] as const;

export const SOLUTION_PILLARS = [
  {
    title: 'Inspect every tools/call',
    body: 'Transparent proxy between agent clients and MCP servers — block malicious calls before they reach the tool server.',
  },
  {
    title: 'Three-layer detection',
    body: 'Regex + JSON Schema + optional LLM semantic audit. Shell tokenizer AST catches obfuscation regex misses.',
  },
  {
    title: 'Response-side DLP',
    body: 'Scan tool outputs for secrets, PII, and prompt injection before they reach the AI model.',
  },
  {
    title: 'Self-improving swarm',
    body: 'Multi-agent Security Swarm continuously red-teams the product and proposes rule updates — compounding defensive advantage.',
  },
] as const;

export const USP_ITEMS = [
  {
    title: 'Native MCP semantics',
    body: 'Understands tool call structure, rug-pull detection, typosquat scanning, and cross-tool chain attacks — not generic HTTP routing.',
  },
  {
    title: '557+ validated attack fixtures',
    body: 'Years of adversarial research shipped in-repo. Competitors would need to replicate from scratch.',
  },
  {
    title: 'Self-sustaining threat research',
    body: 'Live proxy traffic feeds LLM discovery pipelines that auto-generate new adv fixtures — no competitor has this loop.',
  },
  {
    title: 'Enterprise-ready day one',
    body: 'Helm on K8s, Postgres RLS, DPoP OAuth, audit hash chain, mTLS hot-reload, multi-tenant JWT — drops into existing stacks.',
  },
] as const;

export const COMPARISON_ROWS = [
  {
    capability: 'MCP protocol native',
    'mastyff-ai': 'Full stdio, HTTP, SSE, WebSocket',
    generic: 'HTTP-only; breaks on SDK updates',
  },
  {
    capability: 'Prompt injection / tool-chain detection',
    'mastyff-ai': '557+ fixtures + normalization pipeline',
    generic: 'Custom middleware; YAML-only misses ~75%',
  },
  {
    capability: 'Response DLP + secret scanning',
    'mastyff-ai': '267 rules, context-aware redaction',
    generic: 'Not applicable',
  },
  {
    capability: 'Continuous red-team loop',
    'mastyff-ai': 'Security Swarm + Auto Threat Research',
    generic: 'Manual pen tests',
  },
  {
    capability: 'Compliance overlays',
    'mastyff-ai': 'HIPAA, PCI-DSS, GxP templates + audit chain',
    generic: 'Build your own',
  },
  {
    capability: 'Deployment',
    'mastyff-ai': 'Helm chart, <1h on existing K8s',
    generic: 'Weeks of custom integration',
  },
] as const;

export const TARGET_SEGMENTS = [
  {
    title: 'FinTech & payments',
    body: 'AI agents over transaction APIs and payment databases — CISO buyer, platform team deploys.',
  },
  {
    title: 'Healthcare & life sciences',
    body: 'EHR and patient-record workflows — HIPAA audit trail, immutable JSONL hash chain.',
  },
  {
    title: 'SaaS & platform teams',
    body: '500–10,000 employee companies shipping agents to customer data — SOC2 access logging built in.',
  },
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
  { suite: 'Evasion probes', result: '148/155 blocked (7 tracked bypasses)', trust: 'CI-gated' },
  { suite: 'Node live integration', result: '26/26 stdio proxy tests', trust: 'CI-gated' },
  { suite: 'Python ↔ TS parity', result: '400/402 (99.5%) · 0 corpus mismatches', trust: 'Offline mirror' },
  { suite: 'Enterprise 5-scenario sim', result: '330 attacks · 93.33% block · 0 FP', trust: 'Synthetic' },
  { suite: 'Attack learning (long eval)', result: '5003 blocks · instant 41s vs batch 4.9h', trust: 'Repo eval' },
] as const;
