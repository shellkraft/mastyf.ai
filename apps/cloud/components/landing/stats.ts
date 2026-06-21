import {
  NPM_INSTALL_CMD,
  NPM_PACKAGE_NAME,
  NPM_PACKAGE_URL,
  NPM_PRODUCT_NAME,
  SITE_NAME,
} from '@/lib/product-links';

/** What visitors get from mastyf.ai — the website and platform. */
export const PLATFORM_FEATURES = [
  {
    title: 'Security scores',
    body: 'Enter any npm MCP package name and get an instant 0–100 trust score with a plain-English breakdown — no account required.',
    href: '/certified',
    cta: 'Look up a package',
  },
  {
    title: 'Trust badges',
    body: 'Embed a live SVG badge in your README so users can verify a server’s score on a public page.',
    href: '/certified',
    cta: 'See badges',
  },
  {
    title: 'Cloud console',
    body: 'Sign in free to edit policy YAML, copy tenant env snippets, rotate API keys, and manage your fleet — no local install needed.',
    href: '/dashboard',
    cta: 'Open console',
  },
] as const;

/** Simple flow — how mastyf.ai works for most people. */
export const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Look up a package',
    body: 'Type an npm MCP package name (for example @playwright/mcp). Static analysis runs immediately.',
  },
  {
    step: '2',
    title: 'Read the score',
    body: 'See overall grade, category breakdown, and what to fix — written for humans, not security engineers only.',
  },
  {
    step: '3',
    title: 'Share or go deeper',
    body: 'Embed a badge, run an optional deep scan, or sign in to manage policies for your own servers in the cloud console.',
  },
] as const;

export const PROBLEM_BULLETS = [
  'AI agents connect to real tools — databases, GitHub, Slack — through MCP with little visibility for security teams.',
  'One bad MCP server can leak secrets, inject prompts, or chain tool calls into a breach.',
  'Teams need a simple way to know which packages are safe before agents touch production data.',
] as const;

/** Why MCP Guardian exists in the story — foundation, not the headline. */
export const FOUNDATION_POINTS = [
  {
    title: 'Runtime protection',
    body: `${NPM_PRODUCT_NAME} sits between your AI agent and MCP servers, inspecting every tool call and response in real time.`,
  },
  {
    title: 'Battle-tested engine',
    body: '557+ adversarial fixtures, three-layer detection, and a self-improving Security Swarm power the scores you see on mastyf.ai.',
  },
  {
    title: 'Self-host when you need it',
    body: `Install ${NPM_PACKAGE_NAME} from npm to run the proxy on your own infrastructure. mastyf.ai itself is not on npm — it is this website and cloud platform.`,
  },
] as const;

export const HERO_STATS = [
  { value: '0–100', label: 'Trust scores', detail: 'Instant lookup for any npm MCP package' },
  { value: 'Free', label: 'Cloud console', detail: 'Policy, API keys, fleet — sign in with Google or GitHub' },
  { value: '557+', label: 'Attack fixtures', detail: `Detection engine behind ${SITE_NAME}` },
  { value: '11k+', label: `${NPM_PRODUCT_NAME} downloads`, detail: 'Monthly npm installs of the open-source proxy' },
] as const;

export const SWARM_AGENTS = [
  { name: 'Scout', track: 'CI', role: 'Discover tools, CVEs, policy gaps' },
  { name: 'Corpus', track: 'CI', role: '154-attack regression suite' },
  { name: 'Evasion', track: 'CI', role: '85 obfuscation probes' },
  { name: 'Parity', track: 'CI', role: 'Python ↔ TypeScript policy parity' },
  { name: 'BlockGuard', track: 'Runtime', role: 'Policy block on every tools/call' },
  { name: 'InstantLearner', track: 'Runtime', role: 'Rolling stats → attack-pattern suggestions' },
  { name: 'SemanticAuditor', track: 'Runtime', role: 'Tier-2 LLM semantic audit' },
  { name: 'Calibrator', track: 'Runtime', role: 'Threshold tuning from labeled outcomes' },
] as const;

export const DETECTION_LAYERS = [
  {
    title: 'Regex triage',
    body: 'TR39 confusables offline, chaining patterns, fast block on obvious injection and exfil paths.',
  },
  {
    title: 'Schema analysis',
    body: 'Ajv validation, recursive depth limits, maxLength — catch malformed or oversized tool payloads.',
  },
  {
    title: 'Semantic LLM audit',
    body: 'Async tier-2 LLM audit, 10/min cap, 24h cache, Ollama/local fallback when API exhausted.',
  },
] as const;

export {
  NPM_PACKAGE_URL,
  NPM_PACKAGE_NAME,
  NPM_PRODUCT_NAME,
  NPM_INSTALL_CMD,
  SITE_NAME,
};
