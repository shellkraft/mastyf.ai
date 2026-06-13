export type HelpTopic = {
  id: string;
  title: string;
  category: string;
  what: string;
  how: string[];
  benefit: string[];
  trigger: string[];
  dataSources: string[];
  outputs: string[];
  apis: string[];
  rbac?: string;
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'analysis-pipeline',
    title: 'Security analysis pipeline',
    category: 'Activity',
    what: 'End-to-end security swarm: preflight, build, live MCP probes, your servers, traffic summary, calibration, swarm gates, visuals, plain-English report, and technical appendix.',
    how: [
      'Starts a tenant-scoped swarm run and records each stage (preflight, probes, replay, reporting) as job phases.',
      'Collects measured traffic and policy outcomes from history storage and enriches with swarm artifacts.',
      'Publishes progress and final results through status APIs and WebSocket updates so the UI can stream state.',
    ],
    benefit: [
      'Gives operators one deterministic runbook for security posture validation instead of ad-hoc checks.',
      'Makes failures explainable with phase-level logs, enabling faster triage and rollback decisions.',
      'Produces both technical and executive outputs from the same run to align security and leadership views.',
    ],
    trigger: [
      'Activity → Analysis → Run analysis (or Run full nightly)',
      'CLI: pnpm security-swarm:analyze',
    ],
    dataSources: ['history.db', 'tenant swarm artifacts', 'WebSocket swarm:progress'],
    outputs: ['report.json', 'analysis.txt', 'visuals-data.json', 'traffic-summary.json', 'job.log'],
    apis: ['POST /api/security-swarm/run', 'GET /api/security-swarm/status', 'GET /api/security-swarm/job-log'],
    rbac: 'policy_test to run',
  },
  {
    id: 'threat-lab',
    title: 'Threat Lab',
    category: 'Threats',
    what: 'LLM proposes adversarial fixtures and policy rules from real bypasses and semantic TPs. Human accept applies rule to live policy; reject discards.',
    how: [
      'In reactive mode, prioritizes authentic bypasses, then labeled semantic true positives, then threat-intel evidence.',
      'Each candidate is replay-validated, fingerprinted, and written to a signed manifest before review in the dashboard.',
      'Accept action persists a hardened policy rule; reject marks candidate as discarded without mutating policy.',
    ],
    benefit: [
      'Converts real incident evidence into actionable policy updates with human approval gates.',
      'Reduces false confidence by requiring replay/validation before candidate promotion.',
      'Improves long-term protection quality by learning from actual attack attempts, not synthetic-only samples.',
    ],
    trigger: ['Threats → Threat Lab → Run Threat Lab', 'Env: SWARM_THREAT_LAB=true, MASTYFF_AI_LLM_ENABLED'],
    dataSources: ['bypasses.json', 'semantic audit store', 'ThreatIntel poll — no synthetic fallback'],
    outputs: ['threat-lab-candidates.json'],
    apis: [
      'POST /api/threat-discovery/threat-lab/run',
      'GET /api/security-swarm/threat-lab-candidates',
      'POST .../accept',
      'POST .../reject',
    ],
    rbac: 'policy_mutate to accept',
  },
  {
    id: 'auto-research',
    title: 'Auto Threat Research',
    category: 'Threats',
    what: 'Automated corpus fixture writes when confidence ≥ MASTYFF_AI_THREAT_RESEARCH_MIN_CONFIDENCE (default 0.85). Policy is never auto-applied.',
    how: [
      'Scheduler and on-demand runs collect new high-confidence discoveries from semantic signals, blocks, and threat intel.',
      'Writes validated fixtures into the auto-corpus manifest and adversarial fixture set when confidence and replay criteria pass.',
      'Stops at corpus generation: policies remain unchanged until an operator explicitly accepts recommendations.',
    ],
    benefit: [
      'Continuously grows defensive test coverage without requiring manual fixture authoring.',
      'Keeps safety high by separating discovery automation from policy enforcement.',
      'Improves future threat-lab and replay quality by preserving validated attack patterns.',
    ],
    trigger: ['Threats → Auto Research → Run', 'Env: MASTYFF_AI_THREAT_RESEARCH_AUTO=true'],
    dataSources: ['Same authentic inputs as Threat Lab'],
    outputs: ['auto-corpus-manifest.json', 'adv-*.json fixtures'],
    apis: ['POST /api/threat-discovery/auto-research/run', 'GET /api/security-swarm/auto-corpus'],
  },
  {
    id: 'investigate',
    title: 'Incident investigation',
    category: 'Security',
    what: 'LLM kill-chain narrative and agent intent graph for a semantic audit or threat trigger.',
    how: [
      'Takes a trigger record ID and reconstructs surrounding events, tool calls, policy decisions, and semantic context.',
      'Builds structured investigation JSON plus narrative sections for analyst review in the incident drawer.',
      'Links findings back to related Threat Lab flows so analysts can move from investigation to mitigation quickly.',
    ],
    benefit: [
      'Cuts incident triage time by turning raw logs into causally ordered explanations.',
      'Helps analysts understand intent and blast radius rather than only seeing pass/block outcomes.',
      'Supports confident escalation and remediation with evidence-backed summaries.',
    ],
    trigger: ['Investigate on AI copilot row or Threat Lab candidate', 'POST with triggerId'],
    dataSources: ['history.db', 'semantic-audit-store'],
    outputs: ['Investigation JSON in drawer'],
    apis: ['POST /api/incidents/investigate'],
  },
  {
    id: 'infra-charts',
    title: 'Live infrastructure charts',
    category: 'Operations',
    what: 'Traffic, AI learning, semantic buckets, and session regression charts from live proxy data.',
    how: [
      'Fetches live visuals bundle for selected window/region and normalizes chart-ready series in the UI.',
      'Renders traffic, learning, semantic, and regression signals in synchronized chart cards.',
      'Uses sparse-data metadata and empty reasons to prevent misleading chart interpretation.',
    ],
    benefit: [
      'Provides a single operational view across protection efficacy, learning behavior, and regression drift.',
      'Helps detect sudden traffic or semantic distribution changes before they become incidents.',
      'Improves trust in dashboards by surfacing data freshness and sparsity explicitly.',
    ],
    trigger: ['Operations → Overview (or embedded in analysis results)'],
    dataSources: ['GET /api/visuals/live → history.db + session swarm'],
    outputs: ['Chart bundle only — no bundled demo JSON'],
    apis: ['GET /api/visuals/live'],
  },
  {
    id: 'health-report',
    title: 'MCP health report',
    category: 'Home',
    what: 'Downloadable Markdown briefing per MCP server: latency, blocks, tools, recommendations.',
    how: [
      'Builds a server-by-server report from measured latency, success, policy actions, and usage metrics.',
      'Optionally augments deterministic content with narrative summaries when LLM path is enabled.',
      'Exports a timestamped markdown artifact for sharing and compliance evidence workflows.',
    ],
    benefit: [
      'Turns ongoing runtime health into portable evidence for reviews, audits, and handoffs.',
      'Gives leadership and operations a common artifact with both details and recommendations.',
      'Reduces manual reporting overhead with repeatable, API-driven report generation.',
    ],
    trigger: ['Home → Download health report', 'Optional Ollama narrative'],
    dataSources: ['history.db', 'policy snapshot', 'swarm artifacts'],
    outputs: ['mastyff-ai-mcp-health-YYYY-MM-DD.md'],
    apis: ['GET /api/reports/mcp-health', 'GET /api/reports/mcp-health/download'],
  },
  {
    id: 'policy-copilot',
    title: 'Policy copilot',
    category: 'Security',
    what: 'Generate YAML rules or run counterfactual replay against recent blocks.',
    how: [
      'Generate mode proposes candidate rules and replay checks against recent observed traffic patterns.',
      'Counterfactual mode simulates outcome deltas (new blocks/passes and FP risk) on historical windows.',
      'Outputs structured recommendation artifacts and leaves final save/reload decision to the operator.',
    ],
    benefit: [
      'Accelerates safe policy authoring for operators who may not know full rule syntax.',
      'Reduces production risk by evaluating policy impact before rule deployment.',
      'Improves explainability through replay summaries and confidence signals.',
    ],
    trigger: ['Security → Policy → Copilot tab'],
    dataSources: ['Live policy file', 'recent audit'],
    outputs: ['Suggested rules', 'replay summary'],
    apis: ['POST /api/policy/copilot'],
    rbac: 'policy_mutate to apply',
  },
  {
    id: 'live-analytics',
    title: 'MCP Mastyff AI Analytics',
    category: 'Operations',
    what: 'Live traffic, cost, model usage, and provider spend in one dashboard with WebSocket refresh.',
    how: [
      'Aggregates call records by window into traffic, latency, error, token, cost, and model/provider distributions.',
      'Updates KPIs via polling and live patches when WebSocket stream is connected.',
      'Shows budget utilization and spend composition to align usage behavior with FinOps goals.',
    ],
    benefit: [
      'Gives immediate visibility into cost/performance/security tradeoffs from one screen.',
      'Makes model and provider shifts obvious, helping teams control spend and reliability.',
      'Supports faster operational decisions with near-real-time telemetry.',
    ],
    trigger: ['Operations → Analytics', 'Time window: 1h / 24h / 7d / 30d'],
    dataSources: ['history.db call_records', 'GET /api/analytics/summary'],
    outputs: ['KPIs', 'traffic series', 'cost breakdown', 'model donut', 'provider list'],
    apis: ['GET /api/analytics/summary'],
  },
  {
    id: 'security-dashboard',
    title: 'Always-on threat protection',
    category: 'Security',
    what: 'Security score, layer status, threat monitor table (per-row and bulk quarantine), semantic engine status, and RBAC view. Monitor quarantine applies or confirms hardening policy and archives records under Security → Quarantined.',
    how: [
      'Combines posture scoring, threat monitor events, semantic pipeline status, and RBAC context into one surface.',
      'Allows row-level or bulk quarantine actions that enforce/confirm policy hardening and persist history records.',
      'Supports restore workflows with optional rule cleanup and full enforcement status traces.',
    ],
    benefit: [
      'Centralizes reactive and preventive controls so analysts do not context-switch during incidents.',
      'Improves response speed with direct quarantine actions tied to policy enforcement outcomes.',
      'Maintains traceability for audits with archived quarantine and restore evidence.',
    ],
    trigger: ['Security → Dashboard'],
    dataSources: ['history.db blocks', 'semantic-audit-store', 'manifest scans'],
    outputs: ['Threat CSV export', 'quarantine enforcement status', 'optional rule removal on restore'],
    apis: ['GET /api/security/dashboard', 'POST /api/security/threats/quarantine', 'POST /api/security/threats/restore'],
  },
  {
    id: 'threat-intel-quarantine',
    title: 'Threat intel quarantine and remove',
    category: 'Security',
    what: 'AI Copilot threat-intel actions: Quarantine auto-applies blocking policy and archives details; Remove dismisses from active catalog. Policy column opens triggered block context and applied YAML rule.',
    how: [
      'Polls threat-intel feeds and keeps an active catalog for operator action in AI Copilot and Quarantined views.',
      'Quarantine action writes enforcement details and links to applied/suggested policy context.',
      'Remove/restore actions maintain lifecycle state while preserving forensic traceability.',
    ],
    benefit: [
      'Lets teams move from threat awareness to enforceable protection in a single action path.',
      'Prevents silent drift by recording why, when, and how a threat was quarantined or restored.',
      'Improves policy confidence with direct context from triggering evidence.',
    ],
    trigger: ['Security → AI copilot', 'Security → Quarantined'],
    dataSources: ['~/.mastyff-ai/.threat-state.json', '~/.mastyff-ai/threat-intel-actions.jsonl'],
    outputs: ['Policy rule applied', 'quarantine archive (30 days)', 'restore to catalog'],
    apis: [
      'GET /api/ai/threats',
      'POST /api/ai/threats/quarantine',
      'POST /api/ai/threats/dismiss',
      'POST /api/ai/threats/restore',
      'GET /api/ai/threats/quarantined',
      'GET /api/ai/threats/quarantine/policy',
      'GET /api/security/threats/quarantine/policy',
    ],
  },
  {
    id: 'swarm-tribunal',
    title: 'Swarm debate tribunal',
    category: 'Enterprise AI',
    what: 'Automatic multi-agent debate (block vs allow vs auditor) for uncertain semantic audit flags. Processes up to 10 per run; Run next batch debates the next unlabeled uncertain items after prior labels.',
    how: [
      'Selects uncertain semantic outcomes and runs structured multi-role deliberation on each case.',
      'Produces verdicts with confidence/unanimity metadata and optional auto-labeling under explicit config.',
      'Tracks queue progress so analysts can process high-uncertainty items in controlled batches.',
    ],
    benefit: [
      'Improves labeling consistency for edge cases that are hard to classify manually.',
      'Reduces analyst fatigue by prioritizing uncertain records with structured debate output.',
      'Strengthens downstream learning quality by improving truth labels used by adaptive systems.',
    ],
    trigger: [
      'Enterprise AI tab load or Refresh',
      'Run tribunal / Run next batch button',
      'GET /api/learning/semantic/tribunal?limit=10',
    ],
    dataSources: [
      'semantic-audit-outcomes store',
      'uncertainty-ranked queue (confidence near MASTYFF_AI_SEMANTIC_MIN_CONFIDENCE)',
    ],
    outputs: [
      'debate verdicts',
      'eligibleTotal and remainingEligible counts',
      'optional auto-label when MASTYFF_AI_TRIBUNAL_AUTO_LABEL=true',
    ],
    apis: ['GET /api/learning/semantic/tribunal'],
    rbac: 'ai feature tier',
  },
  {
    id: 'guided-setup',
    title: 'Guided setup & cloud control plane',
    category: 'Settings',
    what: 'Checklist for Mastyff AI config, database health, proxy traffic, and optional cloud control plane link.',
    how: [
      'Evaluates setup progress across proxy config, data path health, traffic visibility, and cloud connectivity.',
      'Supports guided write actions for core config fields and control-plane onboarding.',
      'Persists setup state so users can resume onboarding without repeating completed steps.',
    ],
    benefit: [
      'Shortens time-to-value by turning infrastructure setup into a measurable checklist.',
      'Reduces misconfiguration risk with validated setup APIs instead of manual edits.',
      'Improves adoption by giving teams a clear path from install to protected traffic.',
    ],
    trigger: ['Settings → Setup → Connect to Cloud'],
    dataSources: ['~/.mastyff-ai/setup.json', 'onboarding status', 'DATABASE_URL / history.db'],
    outputs: ['Saved proxy settings', 'cloud launch URL'],
    apis: [
      'GET /api/setup/status',
      'POST /api/setup/mastyff-ai-config',
      'GET /api/setup/cloud-status',
      'POST /api/setup/cloud/connect',
    ],
  },
];

export function findHelpTopic(id: string): HelpTopic | undefined {
  return HELP_TOPICS.find((t) => t.id === id);
}
