# Changelog

All notable changes to MCP Guardian will be documented in this file.

## [4.1.6] - 2026-06-01

### Added

- **`mcp-guardian start`** — proxy + dashboard with local dev defaults (`http://localhost:4000`)
- **`mcp-guardian setup`** — one-shot monorepo install (pnpm install, build, dashboard SPA)
- **`mcp-guardian onboard --start`** — onboard then start in one command
- **[docs/INSTALL.md](docs/INSTALL.md)** — installation and troubleshooting guide
- **CI** — `install-smoke.yml` validates npm pack ships prebuilt dashboard `out/`

### Changed

- **README** simplified: install and troubleshooting first; architecture detail moved to linked docs

### Fixed

- Dashboard SPA in pnpm workspace; resilient `build-dashboard-spa.sh` with seed data checks
- `benchmark-report.json` tracked for fresh clones (`.gitignore` scoped to repo root only)
- npm publish builds `deploy/dashboard-spa/out/` before pack; validate tarball includes `index.html`
- `start-dashboard-proxy.sh` falls back to `npm install` in SPA dir when needed

## [4.1.5] - 2026-06-01

### npm install fix (registry manifest)

- **Root cause** — `postpack` restored `workspace:` in `package.json` before `npm publish` indexed registry metadata (4.1.3–4.1.4 broken).
- **Fix** — removed automatic `postpack` hook; publish script restores workspace specs only **after** publish + `verify-npm-registry-manifest.mjs`.

## [4.1.4] - 2026-06-01

### Global CLI onboard fix

- `mcp-guardian onboard` resolves the npm package install root instead of `process.cwd()` (fixes "Build required: pnpm build" on Desktop)
- `guardian-configs/` written under `--workspace-root` (default: current directory)
- npm tarball includes `scripts/guardian-proxy.sh`, `guardian-proxy.ps1`, and `policy-audit.yaml`

## [4.1.3] - 2026-05-31

### npm install fix (registry manifest)

- **Root cause** — `postpack` restored `workspace:` specs before npm indexed registry metadata; tarball was correct but `npm install` / BundlePhobia read broken manifest (`EUNSUPPORTEDPROTOCOL`).
- **Fix** — publishable packages use semver deps (`^4.1.3`); server/CLI publish from `.tgz` so manifest matches tarball.
- **Deprecate** — `@mcp-guardian/server@4.1.1` and `@4.1.2` (broken install).

## [4.1.2] - 2026-05-31

### npm install fix

- **Broken `@mcp-guardian/server@4.1.1`** — that release shipped literal `workspace:` dependencies (`EUNSUPPORTEDPROTOCOL` on install). Use **4.1.2+**.
- **`validate-npm-pack.mjs`** — blocks publish if a tarball still contains `workspace:` specs or install lifecycle scripts.
- **Publish script** — validates server and CLI tarballs before `npm publish`.

## [4.1.1] - 2026-05-31

### npm supply-chain / install hygiene

- **Prepack** — rewrite `workspace:` deps to semver and strip lifecycle scripts (`postinstall`, `prepack`, etc.) from published `@mcp-guardian/server` tarballs
- **Removed `postinstall`** — Windows SQLite guidance moved to `mcp-guardian doctor` / [docs/WINDOWS.md](docs/WINDOWS.md) (no code runs on `npm install`)
- **Dependency overrides** — `qs>=6.15.2`, `turbo>=2.9.14` for known advisories
- **Publish order** — document that `@mcp-guardian/core` and `@mcp-guardian/plugin-sdk` must publish before `@mcp-guardian/server`

## [4.1.0] - 2026-05-31

### Industry roadmap plan compliance (pass 7–8)

- **Plan compliance audit** — runtime verification of all A1–C5 / B1–B3 modules (`plan-compliance-audit.ts`, `guardian roadmap audit`, `GET /api/agentic/plan-compliance/audit`)
- **A1 ONNX graph inference** — optional hot-path classifier via `GUARDIAN_FLEET_GRAPH_ONNX_MODEL`
- **B3 MPC-lite masking** — pairwise-masked gradient aggregation (`GUARDIAN_FEDERATED_MPC`)
- **B2/B1 mesh relays** — observatory and reputation mesh publish/pull; cloud relay ingest with dev stub (`GUARDIAN_OBSERVATORY_STUB`)
- **Dashboard panels** — PlanCompliance, Reputation, ZeroTrust, FederatedLearning, Observatory mesh sync, captured-traffic scorecard, Protection home roadmap strip (Agentic AI workspace)
- **CLI utilities** — `guardian roadmap fleet-graph-train`, `federated-export|import`, `observatory-sync`, `reputation-sync`
- **Migrations 016–019** — fleet alerts, twin observations, policy approvals, federated weights, web-of-trust, threat model reports
- **Docs** — README, AGENTIC_QUICKSTART, AGENTIC_FEATURES, `.env.example` updated for audit CLI and production env vars

## [4.0.0] - 2026-05-30

### Industry Standard MCP Protection

- **Migration 012** — certifications, MTX signatures, session chains, capability graph, intent bindings, sandbox tiers, agent reputation, fuzz runs, playbook runs, compliance controls, benchmark submissions
- **MTX v1** — `@mcp-guardian/mtx` open threat exchange format; cloud hub at `/api/v1/mtx/*`
- **Guardian Certified MCP** — HMAC attestation signing, persistent registry, cloud verification API
- **guardian-bench** — `mcp-guardian bench` CLI + public leaderboard on cloud `/benchmarks`
- **Multi-step chain detection** — collusion detector merged with session-chain graph; proxy enforcement
- **Capability graph + intent binding** — tool/resource graph, session intent allowlists
- **Resource/prompt poisoning guard** — lifecycle guard on `resources/read` and `prompts/get`
- **Dynamic sandbox tiers** — shadow/redact/allow with RL-ready persistence
- **Protocol fuzzer** — expanded corpus, real blockFn, cert gate integration
- **Agent reputation ledger** — persistent scores with proxy enforcement
- **Policy simulator** — unified `/api/policy/simulate` + `ab_test_policy` MCP tool
- **Incident playbooks** — webhook/isolate executors with approval gates
- **Compliance evidence runner** — live policy + audit wired to ControlMapper
- **Docs** — `docs/MTX_SPEC.md`, `docs/MCP_SECURITY_REFERENCE.md`

### Industry-standard agentic roadmap (A1–C5, B1–B3) — compliance pass 2

- **C1 Merkle checkpoints** — true Merkle tree with inclusion proofs (`merkle-tree.ts`, auto-checkpoint every 16 events)
- **A1 Graph causal scorer** — argument-aware confidence boost + Redis cross-replica fleet sync + collusion correlation tags
- **B1 Signed reputation** — HMAC attestations on every rating, weighted consensus, cert cross-check
- **B3 Federated mesh** — delta publish via threat mesh, DB-backed aggregation, canary traffic split, hot-path ONNX routing

- **C5 Semantic Policy Translator** — NL ↔ YAML, `/api/agentic/policy/translate`, approval gate, unsafe-rule rejection
- **C1 Config Provenance Chain** — Merkle audit log, signed tarball export, SIEM hooks, CLI verify
- **C2 Threat Modeling as Code** — STRIDE/LINDDUN, capability-graph DFD, CI golden diff, `guardian threat-model`
- **A3 Behavioral Biometrics** — agent fingerprinting, policy strategy, reputation integration
- **A1 Cross-MCP Attack Chains** — fleet session graph, cross-server blocking, DB-backed cross-restart correlation, persisted alerts, argument-aware graph, CEF/SIEM export, chain visualization
- **A2 Digital Twin & Sandbox** — live proxy capture, observation persistence, captured-traffic replay harness, go/no-go scorecard with baseline p99
- **C3 Zero-Trust Engine** — composite per-call score, SPIFFE, geo/time, step-up via ApprovalGate
- **B1 Reputation Network** — 8-dimension scores, mesh-relay publish, cloud query API
- **B2 Ecosystem Observatory** — bench/heartbeat/MTX ingest, cloud dashboard
- **C4 Insurance Risk Quantification** — ALE modeling, underwriter PDF export
- **B3 Federated Learning** — ε-DP delta exchange, optional ONNX, feature-flagged rollout (`GUARDIAN_FEDERATED_LEARNING=true`)

## [3.4.1] - 2026-05-30

### Security — production readiness (code review remediation)

- **JWKS auto-refresh** — `GUARDIAN_JWKS_REFRESH_MS` (default 5m), proactive refresh before JWT validation, one retry after signature failure, optional background refresh when OAuth is enabled
- **Payload bounds** — `GUARDIAN_MAX_EXPANDED_PAYLOAD_BYTES` caps post-parse tool arguments on all transports; HTTP/SSE/streamable use `readRequestBodyWithLimit`; JSON-RPC errors include `id: 0`
- **Audit args encryption** — `GUARDIAN_DB_ENCRYPT_AUDIT_ARGS` encrypts `argument_snippet` when encryption key is set
- **SIEM** — `StructuredLogger.logBlocked` on policy, semantic, payload, and agentic blocks across stdio/HTTP/SSE/WS/streamable
- **Redis circuit breaker** — cross-replica pubsub + `mcp_guardian_circuit_breaker_sync_total` metric
- **Rate limits survive policy hot-reload** — in-memory counters moved to process-wide `sharedRateLimitStore`
- **Allowlist RBAC** — `GUARDIAN_STRICT_ALLOWLIST_RBAC` requires `rbac` on `tools.allow` rules (default on in enterprise mode)
- **OAuth scopes** — merges `scope` and `scp` claims; optional `rbac.scopeMatch: all|any`
- **Audit retention** — `MCP_GUARDIAN_RETENTION_DAYS` (default 30, max 3650)
- **Postgres field encryption** — `block_reason` encrypted at rest when `GUARDIAN_DB_ENCRYPTION_KEY` is set
- **CVE deduplication** — OSV + NVD findings merged by canonical CVE id
- **Redis circuit breaker sync** — optional shared OPEN/HALF_OPEN state when Redis is configured
- **Semantic skip metrics** — `mcp_guardian_semantic_audit_skipped_total` on async audit, sync semantic, and degradation paths
- **Health probe scheduler** — `GUARDIAN_HEALTH_PROBE_INTERVAL_MS` at proxy boot and in autopilot services
- **Policy reload** — `reloadInFlight` guard prevents overlapping hot-reloads
- **Graceful shutdown** — `GUARDIAN_SHUTDOWN_GRACE_MS` drains in-flight proxy slots before exit
- **Transport parity** — shared `tool-call-pre-guard` (expanded payload + agentic hooks) on SSE, WebSocket, and streamable HTTP
- **Release** — monorepo packages aligned to **3.4.1**; README and `.env.example` updated

## [3.4.0] - 2026-05-28

### Added — 10 Agentic AI Features

- **#1: Predictive Threat Anticipation** (`predict_threats`, `threat_forecast_for_server`, `preemptive_recommendations`) — 5-factor risk scoring (CVE, capability, exposure, velocity, auth) with 30/90/365-day forecasts and preemptive hardening recommendations
- **#2: Autonomous Policy Generation** (`start_behavior_observation`, `stop_behavior_observation`, `generate_policy_from_observations`, `suggest_policy_improvements`, `observation_status`) — Observes AI agent tool calls and generates minimal-privilege YAML policies with rate limits, allow/deny rules, and semantic guard configuration
- **#3: Cross-Deployment Threat Intel Mesh** (`contribute_threat_signature`, `threat_intel_status`) — Privacy-preserving threat intelligence sharing with differential privacy (ε-configurable), signature hashing, and threshold gating. New env vars: `GUARDIAN_THREAT_MESH_ENABLED`, `GUARDIAN_THREAT_MESH_EPSILON`, `GUARDIAN_THREAT_MESH_MIN_REPORTS`
- **#4: Agentic Honeypot Deployer** (`deploy_honeypot`, `honeypot_report`, `destroy_honeypot`, `list_honeypots`) — 7 fake MCP server templates (database, filesystem, GitHub, Slack, API, vault, admin) with auto-destroy and attack pattern detection
- **#5: Supply Chain Integrity Verification** (`verify_supply_chain`, `supply_chain_status`, `sbom_export`) — Trusted publisher verification, dependency confusion detection, typo-squat scanning (Levenshtein against 24+ known packages), CycloneDX/SPDX SBOM export
- **#6: Prompt Injection Detection at MCP Layer** (`scan_prompt_injection`, `prompt_injection_report`) — Two-stage detection pipeline: heuristic (50+ regex patterns across 8 categories) + semantic LLM classification (optional). Includes argument sanitizer for neutralizing detected payloads
- **#7: Autonomous Compliance Evidence** (`generate_compliance_evidence`, `compliance_gap_analysis`, `compliance_posture`, `list_compliance_frameworks`) — Maps active policies to SOC 2, HIPAA, PCI-DSS v4.0, FedRAMP Moderate, and ISO/IEC 27001:2022 controls with posture scoring and gap analysis
- **#8: Agentic Drift Detection & Rollback** (`detect_drift`, `capture_baseline`, `rollback_server_config`, `drift_history`) — Monitors schema changes, performance degradation, and response shape changes with auto-rollback recommendations
- **#9: Autonomous Red Team Engine** (`run_self_assessment`, `schedule_red_team`, `red_team_results`, `ab_test_policy`) — 16 curated base attacks + 6 mutation strategies (case obfuscation, space substitution, null bytes, URL encoding, unicode homoglyphs) + combination engine + A/B policy testing
- **#10: Agent-to-Agent Trust Negotiation** (`negotiate_agent_trust`, `agent_trust_status`, `revoke_agent_trust`, `trust_registry_list`) — 4-stage protocol: capability exchange → policy negotiation → session establishment → audit logging

### Added — Infrastructure

- **Agentic Core Framework** (`src/agentic/core.ts`, `scheduler.ts`, `model-provider.ts`, `task-queue.ts`, `telemetry.ts`) — Shared primitives: `AgenticResult<T>`, `AgenticPipeline`, `ApprovalGate`, cron scheduler, unified LLM interface (OpenAI/Anthropic/Compatible), priority task queue with dedup
- **Proxy Integration Hooks** (`src/agentic/proxy-integration.ts`) — Drop-in functions for proxy pipeline: behavior observation recording, prompt injection checking, threat mesh contribution
- **Dashboard API** (`src/dashboard/agentic-routes.ts`) — 15 REST endpoints for agentic feature data
- **Dashboard UI** (`deploy/dashboard-spa/app/components/workspaces/AgenticWorkspace.tsx`) — New "Agentic AI" workspace with live feature status cards, compliance posture gauges, and honeypot/trust/metric display
- **Workspace Navigation** — Added `agentic` workspace to workspace-nav, DashboardClient, and workspace labels
- **Database Migration** (`011-agentic-tables.sql`) — 14 new tables + 7 indexes for agentic data persistence
- **LLM Configuration** — New env vars: `GUARDIAN_LLM_OPENAI_KEY`, `GUARDIAN_LLM_ANTHROPIC_KEY`, `GUARDIAN_LLM_COMPATIBLE_KEY`, `GUARDIAN_LLM_OPENAI_MODEL`, `GUARDIAN_LLM_ANTHROPIC_MODEL`, `GUARDIAN_LLM_COMPATIBLE_MODEL`, `GUARDIAN_LLM_TIMEOUT_MS`
- **Meta Tool** — `agentic_status` provides overall status of all 10 features

### Added — Benchmarks

- `benchmarks/agentic-policy-gen.ts` — Policy generation performance across observation sizes
- `benchmarks/agentic-scheduler-overhead.ts` — Scheduler CPU/memory overhead
- `benchmarks/agentic-prompt-injection.ts` — Detection latency for benign and suspicious arguments
- `benchmarks/agentic-threat-prediction.ts` — Risk scoring throughput across many servers

### Added — Documentation

- `docs/AGENTIC_FEATURES.md` — Complete feature reference with MCP tools, configuration, and architecture
- `docs/AGENTIC_QUICKSTART.md` — 5-minute getting started guide
- `docs/AGENTIC_ARCHITECTURE.md` — Architecture diagrams, data flows, design principles, module responsibility matrix
- `docs/THREAT_MESH_PRIVACY.md` — Privacy model for cross-deployment threat intelligence

### Added — Tests

- `tests/agentic/agentic-integration.test.ts` — 30+ integration tests covering all 10 features

### Changed

- **Container** (`src/container.ts`) — Extended `Container` interface and `createContainer()` to instantiate all 21 agentic services
- **MCP Server** (`src/index.ts`) — Registered 35 new MCP tools with full input schemas + 35 handler cases (39 tools total)
- **README** — Added agentic AI feature summary table, version bump to 3.4.0

## [3.3.1] - 2026-05-28

### Added

- **Control-plane parity harness** — new parity harness module/CLI path and tests to assert rule behavior consistency between data-plane and control-plane evaluation paths
- **Autopilot assurance modules** — `autopilot-safety-contract`, `continuous-assurance`, `policy-impact-scoring`, `similar-environment-benchmarks`, and `tenant-simulation-pack` with test coverage
- **Dashboard advanced analytics** — new analytics panel and expanded workspace/dashboard components for protection, reliability, and security posture
- **Federated security utilities** — `federated-threat-intel-v2` and `guardian-certified-mcp` helpers plus dedicated tests
- **Policy template segments** — new reusable policy segments for AI startup, enterprise SOC, MCP builder, and regulated profiles

### Changed

- **npm publish alignment** — monorepo workspace packages (`core`, `server`, `cli`, `plugin-sdk`) aligned to **3.3.1**
- **README** — detailed release highlights updated for 3.3.1 and current enterprise tracks
- **Plugin SDK semver metadata** — `PLUGIN_SDK_VERSION`, docs, and tests aligned to 3.3.1

## [3.3.0] - 2026-05-28

### Added

- **Premortem v3.2.7 remediation (complete)** — shared tool-fingerprint helper (rug-pull on `tools/list` responses with `id`), early `proxyMaxInflight` before policy eval, rug-pull cluster shared Redis + local TTL, opt-in policy eval cache (`cacheable` in YAML schema), enterprise sync semantic request gate (default ON with enterprise + LLM), cross-transport parity (stdio/HTTP/WS/SSE/streamable), Prometheus metrics (`rugpull_detected_total`, `proxy_inflight_rejected_total`, `semantic_sync_request_blocks_total`, `policy_cache_hits_total`, `session_flow_backend`)
- **Enterprise deployment guide** — [ENTERPRISE_DEPLOYMENT.md](docs/ENTERPRISE_DEPLOYMENT.md)
- **Ops** — `DELETE /api/internal/rug-pull`; dashboard `/api/health` exposes `semanticRequestGate`

### Changed

- **npm publish** — monorepo workspace packages (`core`, `server`, `cli`, `plugin-sdk`) aligned to **3.3.0**
- **Enterprise mode** — `GUARDIAN_CI_BYPASS_LICENSE` / `GUARDIAN_DEV_UNLOCK_ALL` forbidden at startup; Redis required for multi-replica when `GUARDIAN_STRICT_MODE=true`
- **Policy eval cache** — pass decisions cached only when opt-in (`cacheable: true` or legacy `GUARDIAN_POLICY_EVAL_CACHE_LEGACY_HEURISTIC=true`)
- **Encoding guard** — module-load regex union from injection-detector stems; blocks base64 paraphrase after decode without plain-text false positives
- **README** — restored Glama, Website, TypeScript, and MCP SDK badges

### Fixed

- Rug-pull silent fail on normal JSON-RPC `tools/list` responses
- DoS amplifier: policy/LLM work on overloaded proxy before inflight reject
- Per-request Redis connections and unbounded local rug-pull flags

## [3.2.8] - 2026-05-26

### Changed

- **npm publish** — monorepo workspace packages (`core`, `server`, `cli`, `plugin-sdk`) aligned to 3.2.8 for version-alignment tests
- **README** — version header and release notes updated for npm

## [3.2.7] - 2026-05-26

### Added

- **Dashboard v3 workspaces** — Protection, Activity, Threats, Security, Operations, Settings, Help (`deploy/dashboard-spa/lib/workspace-nav.ts`)
- **Operations analytics API** — `GET /api/analytics/summary` with 1h/12h/24h/7d windows (`src/utils/analytics-summary.ts`)
- **Security dashboard API** — `GET /api/security/dashboard`, `POST /api/security/threats/quarantine`
- **Setup APIs** — `/api/setup/status`, db-health, cloud-status, guardian-config, cloud connect
- **Guardian Autopilot** — `mcp-guardian autopilot` CLI, profile, schedulers, `GET /api/autopilot/status` ([AUTOPILOT.md](docs/AUTOPILOT.md))
- **Full analysis** — `mcp-guardian analyze` / `pnpm analyze` (`src/ai/guardian-full-analysis.ts`, `src/ai/mcp-health-report.ts`)
- **Real-life shared DB** — `MCP_GUARDIAN_DB_PATH` in `createLiveProxySession()` so `real-life:*` traffic feeds the dashboard DB
- **Adversarial fixtures** — `adv-220` through `adv-261` in `adversarial-harness/fixtures/custom-attacks/`

### Changed

- **SOC dashboard** — split into modular SOC/live panels, `SocDashboardLayout`, enterprise design tokens
- **Dashboard proxy** — `pnpm dashboard:proxy` rebuilds dist when dashboard API sources change
- **README** — v3 quick start, live attack runbook, simplified feature list

### Fixed

- **Analytics 1h window** — `parseRecordTimestamp()` for SQLite `created_at` without timezone (`src/utils/time-buckets.ts`)

## [3.2.6] - 2026-05-24

### Fixed

- **Dashboard SPA `ThreatDiscoveryAutomation` bare `fetch()` calls** — Replaced all 7 direct `fetch()` calls with `guardianFetch()` + `buildMutatingHeaders()` so the scheduler panel correctly resolves `apiBase`, sends auth/CSRF headers, and renders even when individual endpoints fail. Previously the start-scheduler button stayed greyed out and the component crashed on any API error.
- **Dashboard "No data in selected window" on all charts** — Community tier license gate was silently disabling the dashboard REST API (`"Dashboard API disabled; WebSocket at /ws only"`). Dashboard now runs with `GUARDIAN_CI_BYPASS_LICENSE=true` for local development, or via standalone `dashboard:serve` script.
- **Cline MCP wrapper port conflicts** — Per-server `guardian-proxy.sh` wrappers in `cline_mcp_settings.json` now set `DASHBOARD_ENABLED=false`, `GUARDIAN_WS_ENABLED=false`, `METRICS_ENABLED=false` so they don't compete for port 4000 with the central dashboard proxy.

### Changed

- **SPA version** — `@mcp-guardian/dashboard-spa` bumped to `2.8.1`.

## [3.2.2] - 2026-05-24

### Added

- **Enterprise AI dashboard tab** — LoRA export/train, supply chain graph, shadow red team, federated signature hints, swarm tribunal, compliance briefing, semantic audit table, and **Incident Investigator** drawer (`POST /api/incidents/investigate`).
- **Threat-intel policy guard** — `threat-intel` strategy + `config/threat-intel-signatures.json`; blocks Threat Lab / CVE probes on allowlisted tools (Node + Python harness parity).
- **Tier 1/2 AI modules** — Policy copilot, counterfactual replay, shadow red team, supply chain graph, swarm debate tribunal, compliance copilot, tenant LoRA pipeline (`tenant-model-export`, async train API), semantic active learning, tool integrity watch, SOAR playbooks, session chain detector, federated threat radar.
- **Security swarm agents** — Optional `SWARM_TOOL_WATCH`, `SWARM_SHADOW_RED_TEAM`, `SWARM_RED_TEAM_PERSONAS` phases; dashboard smoke test includes React SPA + LoRA export.
- **Cloud fleet APIs** — Federated threat radar + threat graph routes; fleet heartbeat extensions.

### Fixed

- **Security Swarm fast-mode bypass gate** — Stale `comprehensive-eval.json` no longer fails the pipeline when parity and `test_harness_report.json` are clean.
- **Swarm CLI dev unlock** — `NODE_ENV=development` + `GUARDIAN_DEV_UNLOCK_ALL=true` bypasses `check-pro.js` without a license key (maintainer local runs).
- **Incident investigator UX** — Clear API error when proxy runs stale dashboard routes; rebuild + restart required after upgrade.

### Changed

- **CI** — `pnpm dashboard:build` in smoke-test workflow; [PRO_SETUP.md](docs/PRO_SETUP.md) documents React SPA build for Enterprise AI.

## [3.2.1] - 2026-05-23

### Added (MCP Tests 31 closure)

- **Comprehensive analysis artifact** — `reports/enterprise-mcp-tests-31/MCP_GUARDIAN_COMPREHENSIVE_ANALYSIS.md`.
- **GxP policy template** — `policy-templates/gxp-compliance.yaml`.
- **Cost optimization API** — `GET /api/cost/recommendations` + dashboard CostGovernancePanel rail.
- **Postgres partition maintenance** — `scripts/postgres-partition-maintenance.mjs`.
- **CodeQL SAST** — `.github/workflows/codeql.yml`.
- **CI scale pilot** — enterprise job runs `pnpm test:scale-postgres` at concurrency 50.
- **Multi-region failover tests** — `tests/utils/multi-region-failover.test.ts`.

### Fixed

- **Core semantic circuit open** — `engine.ts` uses local heuristic fallback instead of silent skip.
- **Cross-provider Ollama fallback** — core semantic scanner retries via Ollama when cloud LLM fails.
- **Policy ReDoS fail-closed** — `GUARDIAN_POLICY_REJECT_UNSAFE_REGEX` throws on unsafe patterns at load (production default).
- **Response DLP secret spans** — generic secret scanner matches get start/end for context-aware redaction.
- **Session rotate-on-use audit** — rotation events logged to `session-audit.jsonl`.
- **WebSocket upstream timeout** — `GUARDIAN_UPSTREAM_TIMEOUT_MS` on WS connect.
- **Local semantic cache tenant isolation** — cache keys include `tenantId`.
- **Audit residency stamping** — policy audit records include `residency_region` from `GUARDIAN_REGION`.

## [3.2.0] - 2026-05-23

### Added

- **Enterprise dashboard redesign** — Overview, Cost, Security, Health, Audit, and Fleet panels with KPI cards, Recharts hub, executive summary APIs, and measured insight rails.
- **Strict live-only data policy** — Session-gated swarm/batch artifacts (`GUARDIAN_DASHBOARD_STRICT_LIVE`, default on); committed `reports/security-swarm/` hidden until a job runs in the current dashboard session.
- **Live semantic visuals** — Semantic charts sourced from the proxy semantic audit store instead of batch `calibration.json`.
- **New dashboard APIs** — `/api/dashboard/executive-summary`, `/api/dashboard/insights`, `/api/cost/timeseries`, `/api/audit/heatmap`.

### Fixed

- **Threat Lab runner** — Missing `isAuthenticSemanticTp` import caused proactive/reactive runs to crash at `main()`.

## [3.1.0] - 2026-05-23

### Added

- **Threat Lab** — LLM-driven threat discovery via local Ollama (`threat-lab.mjs`, `src/ai/threat-lab.ts`); reactive (bypass-driven) and proactive (corpus-seeded) modes; no synthetic fallback when LLM is offline ([THREAT_LAB.md](docs/THREAT_LAB.md)).
- **Auto Threat Research** — Runtime + batch pipeline (`threat-research-pipeline.ts`, `auto-threat-research.mjs`) writes validated `adv-*.json` corpus fixtures from semantic TPs, ThreatIntel, and instant-learning signals.
- **Threat Discovery dashboard** — Dedicated Pro tab with architecture view, Threat Lab workbench, Auto Research monitor, run controls, candidate drawer, and live status APIs (`/api/threat-discovery/*`).
- **Training data export** — `pnpm ai:export-training-data` → `exports/training-dataset.jsonl` for future LoRA fine-tune.
- **LLM prerequisites docs** — [PRO_SETUP.md](docs/PRO_SETUP.md) and README Pro section document that Ollama + `qwen3:8b` are not bundled with npm/git clone.

### Changed

- **Swarm Analysis tab** — Threat Lab / auto-corpus tables replaced with summary cards linking to Threat Discovery.
- **Semantic audit store** — Human-labeled TPs feed Threat Lab and auto research; calibrator seeds excluded by default.
- **Instant attack learning** — Bridges argPatterns and threat taxonomy into suggestion engine and threat intel.

## [3.0.0] - 2026-05-24

### BREAKING — Pro paywall hardening

- **Security Swarm CLI** (`pnpm security-swarm:*`, `run-analysis.mjs`) requires a valid **MCP Guardian Pro** license (`GUARDIAN_LICENSE_KEY` + `GUARDIAN_CONTROL_PLANE_URL`).
- **`GUARDIAN_OPEN_CORE=false` removed** — no longer disables Pro gates. Maintainer dev only: `NODE_ENV=development` + `GUARDIAN_DEV_UNLOCK_ALL=true`.
- **Fleet CLI** (`mcp-guardian fleet`) and **TUI Fleet tab** require Pro.
- **AI attack learning** on the proxy (instant + debounced cycles) requires Pro; Community keeps regex/schema block.
- **Dashboard** with `DASHBOARD_ENABLED=true` fails startup without Pro license (when open-core gates apply).

### Added

- **Dual license** — [LICENSE-PRO](LICENSE-PRO), [COMMUNITY_SCOPE.md](COMMUNITY_SCOPE.md), [docs/PRO_LICENSE.md](docs/PRO_LICENSE.md).
- **`src/license/enforce-pro.ts`** + `node dist/license/check-pro.js <feature>` for scripts.
- **`GUARDIAN_CI_BYPASS_LICENSE`** — CI workflows only (not for end users).

### Changed

- Older releases: **npm &lt; 2.9.7** had no license system; **2.9.7–2.10.x** allowed swarm CLI bypass. Upgrade to **3.0+** for enforced Pro CLI.

## [Unreleased]

### Added
- **Pro monetization E2E** — Live Lemon Squeezy checkout URL default; `POST /api/webhooks/lemonsqueezy` auto-registers `license_key_created` keys; `pnpm cloud:register-pro-key` manual fallback; migration `006_pro_license_webhook.sql`.
- **`@mcp-guardian/core` offline regex** — TR39 `confusables.txt` pre-pass (`MCPG-R-092`), distance-aware `first…then` chaining (`MCPG-R-093`), `docs.openai.com` URL allowlist for MCPG-R-020.
- **§6 enterprise closure** — LLM cache 24h default; local semantic on LLM failure; Postgres RLS session (`008-tenant-rls-extended.sql`); DPoP lock-free claim; HIPAA audit doc; DR restore runbook.
- **`@mcp-guardian/core` semantic hardening** — in-process circuit breaker, local heuristic fallback when LLM absent, per-tenant semantic queue caps, explicit skip reasons in scan timings.
- **Policy compile cache** — `getOrCreatePolicyEngine()` reuses compiled engines across hot-reloads (`policy-engine-cache.ts`).
- **Dashboard query cache** — Redis/local TTL cache for `GET /api/cost/breakdown` (`GUARDIAN_DASHBOARD_QUERY_CACHE`).
- **Helm ops** — Postgres `pg_basebackup` CronJob, PgBouncer ConfigMap (`pool_mode=transaction`, `server_idle_timeout=300`).
- **Database ops doc** — [DATABASE_OPERATIONS.md](docs/DATABASE_OPERATIONS.md) (partitioning, backups, scale test).
- **HTTP redaction header** — `X-Guardian-Redaction-Reason` on HTTP proxy when DLP redacts responses.

### Changed
- Enterprise Helm overlay enables `GUARDIAN_SEMANTIC_SYNC_RESPONSE` + `GUARDIAN_LOCAL_SEMANTIC` by default.
- Grafana SLO dashboard adds compliance % panel and per-tenant cost panel.
- Scale Postgres script reports insert p99 and tenant read latency.

## [2.10.0] - 2026-05-23

### Added
- **Shared MCP gateway** — `GUARDIAN_GATEWAY_MODE` / `mcp-guardian proxy --gateway`; Helm `gateway.*` ingress for `/sse` and `/message`; [GATEWAY_DEPLOY.md](docs/GATEWAY_DEPLOY.md).
- **WebSocket in ProxyManager** — `transport: "websocket"` in MCP config; hot-reload policy across WS instances.
- **Security swarm hardening** — per-step `spawnSync` timeouts, 2MB `maxBuffer`, stderr redaction, HMAC-signed `evasion-promotions.json`, 3-failure circuit breaker.
- **Per-tenant budget on hot path** — `GUARDIAN_TENANT_DAILY_BUDGET_JSON` enforced before async semantic LLM (`tenant-budget.ts`).
- **`@mcp-guardian/core` JSON Schema validation** — Ajv `validateSchema` before property traversal (`MCPG-S-005`).
- **Grafana SLO dashboard** — `deploy/grafana/mcp-guardian-slo.json` (p99 latency, semantic skips, blocks).

### Changed
- Enterprise Helm overlay defaults: `GUARDIAN_SEMANTIC_ASYNC=true`, `GUARDIAN_GATEWAY_MODE=true`, semantic LLM rate cap.
- Dashboard access log events chained to SIEM audit trail when `GUARDIAN_AUDIT_HASH_CHAIN` is enabled.
- Gap closure doc: `reports/enterprise-mcp-tests-31/gap-matrix.md` (mcp tests 31 analysis package).

## [2.9.7] - 2026-05-23

### Added
- **Live dashboard data** — Overview, Audit, Cost, AI, and Agent flow tabs read live `history.db` and threat state; ThreatIntel SPA; `/api/visuals/live` reuses proxy `runtimeHistoryDb` (no open/close churn).
- **Tenant-scoped security swarm** — artifacts under `reports/tenants/<tenant>/security-swarm/`; continuous live attack runner; swarm hardening after long runs.
- **Dashboard policy editor** — `PUT /api/policy` with YAML schema validation, atomic write, editable PolicyPanel (Save / Discard), RBAC `policy_mutate`.
- **Free OSS cloud control plane MVP** — `apps/cloud` with OAuth stubs, policy API, Vercel deploy docs.
- **Open-core Pro licensing** — Community tier on npm (MIT); Pro features gated at runtime via `GUARDIAN_OPEN_CORE`, cloud license API, dashboard upgrade banner.
- **Enterprise analysis remediation** — response DLP HTML/URL decode, semantic LLM circuit breaker + per-tenant rate limits, tenant audit JSONL, `GET /api/audit`, HIPAA/PCI templates, optional Postgres RLS `006`, cost breakdown API, scale test script.
- **`@mcp-guardian/core`** — recursive schema scan, Ollama semantic fallback, multi-step/confusable regex heuristics.

### Changed
- README aligned with tenant-scoped swarm artifact paths; Helm PDB auto-enables when `replicaCount > 1`.
- `docs/SAAS_CONTROL_PLANE.md` Mermaid diagram uses quoted node labels (fixes GitHub render for `/api/v1/policy`).

## [2.9.6] - 2026-05-22

### Fixed
- **Publish workflow** — use `pnpm run build` (turbo order) instead of `pnpm -r build` so `@mcp-guardian/cli` builds after `packages/server`.
- **CLI package build** — `pnpm --dir ../server run build && tsc` for explicit dependency order.
- **scan-mcp workflow** — scan from repo `dist/cli.js` instead of `npx @mcp-guardian/server@latest` (broken `workspace:*` on npm).
- **Docker cosign** — use `cosign sign` CLI instead of unavailable `sigstore/cosign-action` repo.
- **prepack** — rewrite all workspace deps (`plugin-sdk`, `core`, `server`) for npm tarballs; CLI package prepack/postpack hooks.

## [2.9.5] - 2026-05-22

### Fixed
- **npm tarball smoke** — `prepack`/`postpack` rewrite `workspace:^3.0.0` plugin-sdk dep to `^3.0.0`; smoke installs plugin-sdk tarball first.
- **Publish workflow** — build + publish `@mcp-guardian/plugin-sdk` before corpus eval and server publish.
- **Coverage CI** — align thresholds and excludes with enterprise module footprint (~58% gate).

### Added
- **Staging pilot tooling** — `deploy/docker-compose.staging.yml`, `scripts/staging-apply-migrations.sh`, `scripts/issue-pilot-jwt.mjs`, `reports/pilot-signoff.md`.
- **Beta tenant policy** — `policy-templates/tenants/beta/policy.yaml` and `acme/` pilot template.
- **Smoke CI** — Redis + Postgres services + enterprise preflight step.

## [2.9.4] - 2026-05-22

Enterprise multi-tenant hardening release on npm — CI stability fixes and compliance evidence pack.

### Added
- **Enterprise compliance pack** — `reports/compliance-pack/` with summary and manifest; `pnpm enterprise:compliance-report`.
- **Dedicated harness vitest config** — `vitest.harness.config.ts` for Security Swarm node tests (separate from main `pnpm test`).

### Fixed
- **CI vitest worker RPC timeout** — exclude `adversarial-harness/**` from default vitest suite; long harness tests run via `pnpm harness:node` / Security Swarm only.
- **Sanitize symlink test** — use `/usr/bin/true` target (not `/etc/passwd`, which is allowlisted).
- **Streaming inspector CI flakes** — 90s test timeout; harness streaming-race aligned.

### Changed
- **Workspace versions** — `@mcp-guardian/core`, `@mcp-guardian/server`, `@mcp-guardian/cli` aligned to **2.9.4** with root.

- **Unified response security gate** — `gateToolResponseText()` (DLP, sync semantic, inspection) on stdio, HTTP, SSE, WebSocket, and streamable HTTP (`GUARDIAN_SEMANTIC_SYNC_RESPONSE`).
- **Per-tenant semantic JSON** — `GUARDIAN_TENANT_SEMANTIC_JSON` overrides `syncResponse`, `asyncAudit`, `strict`, etc. per tenant.
- **Audit hash chain** — `GUARDIAN_AUDIT_HASH_CHAIN` for policy audit + optional SIEM JSONL (`GUARDIAN_AUDIT_HASH_CHAIN_SIEM`).
- **OIDC token introspection** — `GUARDIAN_OIDC_INTROSPECTION` (RFC 7662) after JWT verify.
- **Redis token revocation** — cluster-wide denylist when `REDIS_URL` is set.
- **mTLS hot-reload** — `getMtlsAgent()` + `MtlsCertWatcher` wired into HTTP/SSE proxies.
- **Streamable HTTP upstream relay** — `GUARDIAN_STREAMABLE_HTTP_UPSTREAM_RELAY` with response gate and session rotation.
- **Integration test config** — `vitest.integration.config.ts`; `pnpm test:integration` runs `tests/integration/**`.
- **Dashboard RBAC** — roles `viewer`, `analyst`, `operator`, `admin`, `tenant-admin`; `GUARDIAN_DASHBOARD_ROLES` API key mapping; route guards in `dashboard-server.ts`; `POST /api/policy/test` for operators; tests `tests/auth/dashboard-rbac.test.ts`.
- **Streaming response inspection** — `src/utils/streaming-inspector.ts` (64KB windows + overlap); wired to stdio/SSE/WS proxies; `GUARDIAN_SKIP_RESPONSE_SCAN` for trusted upstream.
- **Local semantic fallback** — `src/ai/local-semantic-classifier.ts` heuristic risk 0–1 when no LLM API key; wired in `async-semantic-audit.ts`; `GUARDIAN_LOCAL_SEMANTIC` (default on without keys).
- **Distributed policy eval cache** — Redis + LRU keyed `tenant+server+tool+argsHash` (`GUARDIAN_POLICY_EVAL_CACHE`, `GUARDIAN_POLICY_EVAL_CACHE_TTL_MS`); documented in [docs/MULTI_TENANCY.md](docs/MULTI_TENANCY.md).
- **Integration fixture matrix** — `tests/integration/mcp-fixtures.test.ts` (echo stdio, filesystem fixture, SQL block); `pnpm test:integration`.
- **Per-tenant metrics** — `tenant_id` label on request/block/latency Prometheus series.
- **Per-tenant daily budget** — `GUARDIAN_TENANT_DAILY_BUDGET_JSON` for `CostAuditor`.
- **Enterprise readiness scorecard** — [docs/ENTERPRISE_READINESS.md](docs/ENTERPRISE_READINESS.md).

### Changed
- **Lazy OPA** — evaluates only when `policy.opa: true` or `GUARDIAN_OPA_ENABLED=true` (and `OPA_URL` set).

### Fixed
- **100% corpus attack block rate** — SQL/NoSQL/LDAP (`DELETE FROM`, sensitive `SELECT *`, `$where`/`$gt`/`$regex`/`$ne`, LDAP filters), SSRF (RFC1918 + metadata + freetext URL extraction), prompt injection (request-path `scanToolCallArguments` on all leaves), base64-decode-to-shell, kubeconfig paths; `scripts/verify-corpus-parity.sh` gates CI on `pnpm eval` (154/154 attacks, 0 false positives with `GUARDIAN_DISABLE_SEMANTIC=true`).

### Closed — 71/100 review headline gaps (verified 2026-05-19)
- **PI request-path recall** — 32/32 prompt-injection corpus blocked via `scanToolCallArguments` before YAML rules (`GUARDIAN_DISABLE_SEMANTIC=true` eval pass).
- **Async audit hot path** — `persistCallRecord` → `enqueueAuditWrite`; block-learning deferred off deny path; proxy tier c=1 p95 &lt; 150 ms.
- **Static imports in `evaluateAsync`** — no dynamic `await import()` on policy hot path.
- **SCA synthetic labeling** — banners on all `sca/*.md` deliverables.
- **Multi-tenancy** — JWT-authoritative tenant binding, `TenantPolicyRegistry`, per-tenant policy templates, RBAC `tenants:`, [docs/MULTI_TENANCY.md](docs/MULTI_TENANCY.md).

### Added
- **Stdio stdin serial queue** — CLI and `McpProxyServer` serialize `handleClientInput` via `AsyncSerialQueue` (no `currentRequestId` races on rapid lines).
- **Circuit breaker HALF_OPEN** — single in-flight probe (`probing` flag); concurrent callers rejected until probe completes.
- **OPA LRU cache** — `(tenantId, serverName, toolName, argsHash)` with `GUARDIAN_OPA_CACHE_TTL_MS` (default 5000 ms, max 1000 entries); only block decisions cached.
- **Policy shadow / dry-run** — `GUARDIAN_POLICY_SHADOW_PATH` evaluates shadow YAML in parallel; logs `shadow_would_block` without enforcing.
- **tools/call idempotency** — `params._meta.idempotencyKey` or header; Redis/memory dedupe in block mode (`GUARDIAN_IDEMPOTENCY_TTL_MS`).
- **Upstream cert pinning** — `GUARDIAN_UPSTREAM_CERT_PIN_SHA256` SPKI SHA-256 pins on HTTPS agents (`src/utils/upstream-cert-pin.ts`).
- **WebSocket proxy parity** — OAuth/DPoP, circuit breaker, secret scan, rug-pull fingerprint, response PI block, `persistCallRecord`, structured logs.
- **Streamable HTTP proxy (MVP)** — `StreamableHttpProxyServer` `POST /mcp` batch handler (`src/proxy/streamable-http-proxy-server.ts`).
- **Stdio connection pool** — `GUARDIAN_STDIO_POOL_SIZE` (2–4) round-robin workers via `StdioConnectionPool`.
- **Redis block-learning lock** — `SET NX` per tenant when `REDIS_URL` set; prevents duplicate learning cycles across pods.
- **SPIFFE workload API** — `GUARDIAN_SPIFFE_SOCKET_PATH` fetches SVID into mTLS env; [docs/SPIFFE.md](docs/SPIFFE.md).
- **JWT-authoritative tenant** — when `GUARDIAN_MULTI_TENANT_ENABLED=true` and authenticated, tenant must come from `GUARDIAN_JWT_TENANT_CLAIM`; header/meta mismatch rejected.
- **DPoP in block mode** — required when policy `mode: block`, `GUARDIAN_BLOCKING_MODE=true`, or `GUARDIAN_REQUIRE_DPOP=true`; legacy bypass `GUARDIAN_LEGACY_NO_DPOP`.
- **Request-path prompt injection** — `scanToolCallArguments()` walks all argument string leaves with full critical/high/medium regex set; wired in `PolicyEngine.evaluate` before YAML rules (`request-prompt-injection`).
- **Shared arg leaf walker** — `src/policy/arg-leaf-walker.ts` used by PI, SQL/SSRF, path, and base64 guards (no duplicate recursion).
- **Async audit write queue** — `src/database/audit-write-queue.ts`; `persistCallRecord` enqueues only (`GUARDIAN_AUDIT_QUEUE_MAX`, `GUARDIAN_AUDIT_QUEUE_BATCH`); SIGTERM flush via shutdown hooks.
- **Enterprise multi-tenancy (full)** — JWT tenant claim binding (`GUARDIAN_JWT_TENANT_CLAIM`), `TenantPolicyRegistry` + `policy-templates/tenants/{id}/policy.yaml`, RBAC `tenants: [...]` in policy rules.
- **SCA synthetic labeling** — banners on executive/live simulation docs under `sca/`.
- **SSE proxy HTTP+SSE lifecycle** — `SseProxyServer.start()` serves `GET /sse` + `POST /message?sessionId=` with upstream session bridging; `ProxyManager` logs local listen URL.
- **CVE API disk cache** — OSV/NVD responses cached under `~/.mcp-guardian/cve-cache` (`GUARDIAN_CVE_CACHE_DIR`, `GUARDIAN_CVE_CACHE_TTL_MS`); stale cache on failure + structured `cve_lookup_degraded` log.
- **Proxy concurrency cap** — `GUARDIAN_PROXY_MAX_INFLIGHT` (default 50) fail-fast on stdio proxy when too many pending `tools/call`.
- **`pnpm version:check`** — `scripts/verify-version-alignment.ts` fails CI if root vs `packages/{core,server,cli}` drift.
- **Transport docs** — [docs/TRANSPORT.md](docs/TRANSPORT.md) (stdio, SSE, HTTP, WebSocket MVP limits).
- **Real-life scenario README** — [scenarios/real-life/README.md](scenarios/real-life/README.md) env + `GUARDIAN_SCAN_STRICT` CI mode.
- **Multi-tenancy (substantial)** — validated tenant resolution (`X-Guardian-Tenant`, `X-Tenant-Id`, `GUARDIAN_TENANT_ID`, `_meta.tenantId`); per-tenant circuit breakers, Redis rate-limit keys (`tenant:{id}:...`), session/DPoP namespacing, attack-learning state paths (`~/.mcp-guardian/tenants/{id}/`), SQLite `call_records.tenant_id`, PG migration `004-tenant-scoping.sql`, tenant-scoped GDPR erase, Helm `multiTenant.enabled`, [docs/MULTI_TENANCY.md](docs/MULTI_TENANCY.md).
- **Multi-tenancy audit tables** — `tenant_id` on SQLite and PostgreSQL `cost_records`, `security_scans`, `health_checks` (migration `005-tenant-cost-security-health.sql`); tenant-scoped reads/writes, GDPR erase, and `AuditTrailSync` aggregation.
- **Multi-tenancy batch & dashboard scoping** — CLI `--tenant` on `scan`/`audit`/`health`/`report`; tenant-scoped `getDistinctScannedServers` / `getDistinctActiveServers`; dashboard/TUI list APIs filter by resolved tenant; `AuditTrailSync.getUnified*Records(tenantId)` and tenant-aware `getAggregatedMetrics(tenantId)`.

### Fixed
- **Per-client rate limit dead path** — removed broken `checkPerClientRateLimit` from stdio proxy; rate limits use `PolicyEngine.evaluateAsync` / Redis only.
- **Policy hot path** — static imports for OPA and Redis rate limiter in `evaluateAsync` (removed per-call dynamic `import()`).
- **Security detection recall** — SQL/NoSQL/LDAP patterns (`DELETE FROM`, `SELECT *` on sensitive tables, `$ne`/`$regex`, LDAP `admin)(&`); SSRF scans freetext `message`/`body`/`link` keys; base64-decode-to-shell chains; k8s `.kube/config` paths; prompt-injection heuristics for “turn off safety filters” / inverse-instructions phrasing.
- **HTTP proxy method forwarding** — `packages/server/src/http-proxy.ts` preserves client HTTP method for non-JSON and non-`tools/call` bodies (GET/stream regression).
- **Cost auditor empty DB** — distinguishes no `call_records` for server vs empty database; points to `run-live-proxy-test.mjs`.
- **Health probes** — `GUARDIAN_HEALTH_PROBE_RETRIES` (default 2 retries) + `GUARDIAN_HEALTH_PROBE_TIMEOUT_MS` for `McpClient.probe`.

### Environment
| Variable | Default | Purpose |
|----------|---------|---------|
| `GUARDIAN_PROXY_MAX_INFLIGHT` | `50` | Max concurrent pending `tools/call` per stdio proxy |
| `GUARDIAN_SSE_PROXY_PORT` | `0` | Fixed local port for SSE proxy (or per-server `env`) |
| `GUARDIAN_CVE_CACHE_DIR` | `~/.mcp-guardian/cve-cache` | Disk cache for OSV/NVD |
| `GUARDIAN_CVE_CACHE_TTL_MS` | `900000` | Fresh TTL for CVE cache entries |
| `GUARDIAN_SCAN_STRICT` | `false` | CI: fail on degraded CVE lookup, missing auth, typo-squat |
| `GUARDIAN_HEALTH_PROBE_RETRIES` | `2` | Extra health probe attempts after first failure |
| `GUARDIAN_HEALTH_PROBE_TIMEOUT_MS` | `15000` | Per-probe timeout for stdio/SSE handshake |
| `GUARDIAN_MULTI_TENANT_ENABLED` | `false` | Shared gateway — clients send tenant headers |
| `X-Guardian-Tenant` / `X-Tenant-Id` | — | Request-scoped tenant (HTTP/SSE/dashboard) |
| `GUARDIAN_JWT_TENANT_CLAIM` | `tenant_id` | JWT claim matched to request tenant |
| `GUARDIAN_AUDIT_QUEUE_MAX` | `5000` | Max in-memory audit write queue depth |
| `GUARDIAN_AUDIT_QUEUE_BATCH` | `32` | Audit queue drain batch size |
| `GUARDIAN_OPA_CACHE_TTL_MS` | `5000` | OPA block-decision cache TTL (0 disables) |
| `GUARDIAN_POLICY_SHADOW_PATH` | — | Shadow policy YAML for dry-run logging |
| `GUARDIAN_IDEMPOTENCY_TTL_MS` | `300000` | Idempotency key dedupe window |
| `GUARDIAN_UPSTREAM_CERT_PIN_SHA256` | — | Comma-separated upstream SPKI SHA-256 pins |
| `GUARDIAN_STDIO_POOL_SIZE` | `1` | Stdio worker pool size (max 4) |
| `GUARDIAN_BLOCKING_MODE` | `false` | Require DPoP on authenticated HTTP/SSE/WS |
| `GUARDIAN_LEGACY_NO_DPOP` | `false` | Disable DPoP requirement for legacy clients |
| `GUARDIAN_SPIFFE_SOCKET_PATH` | — | SPIFFE Workload API Unix socket |

## [2.9.3] - 2026-05-22

Seamless analysis platform and npm publish of post-2.9.2 dashboard work ([`6b445c6`](https://github.com/rudraneel93/mcp-guardian/commit/6b445c6)).

### Added
- **Enterprise deploy** — [docs/ENTERPRISE_DEPLOY.md](docs/ENTERPRISE_DEPLOY.md), Helm [values-enterprise.yaml](deploy/helm/mcp-guardian/values-enterprise.yaml), `pnpm enterprise:preflight`, `pnpm enterprise:evidence-pack`.
- **Enterprise roadmap** — [docs/ENTERPRISE_ROADMAP.md](docs/ENTERPRISE_ROADMAP.md) (v3 control plane, gateway, multi-region priorities).
- **Solo onboarding** — `pnpm onboard` / `mcp-guardian onboard` wraps IDE MCP configs and patches Cursor/Cline settings.
- **Dashboard SPA** — Setup, Agent flow, and Analysis tabs; WebSocket timeline; plain-English `report.json` inline; infrastructure visuals (`GET /api/visuals/live`, Recharts + matplotlib gallery).
- **Security swarm analyze** — `pnpm security-swarm:analyze` orchestrator; `traffic-summary.json`, `visuals-data.json`, `plain-english-report.mjs`; `scripts/start-dashboard-proxy.sh`.
- **Agent proxy traffic** — `pnpm agent:proxy-traffic` records benign filesystem MCP calls through Guardian for personalized reports.
- **Live filesystem scenario** — `scenarios/real-life/run-official-filesystem-scenario.mjs`; CI workflows for corpus PR and semantic calibrate.

### Fixed
- **adv-066 allowlist bypass** — allowlisted tools re-check encoding + prompt-injection on arguments before `allowlist` pass ([`yaml-rules-strategy.ts`](src/policy/strategies/yaml-rules-strategy.ts)); regression [`tests/policy/allowlist-evasion.test.ts`](tests/policy/allowlist-evasion.test.ts).
- **Plain-English report** — pass `visuals` into template builder (fixes crash when regenerating `report.json`).
- **Dashboard proxy** — rebuild stale `dist` when dashboard API sources change; improved visuals API error messaging; timeline scroll confined to panel.

### Changed
- **README** — Start here, dashboard & seamless analysis, Security Swarm architecture diagram, expanded FAQ.
- **Workspace versions** — `@mcp-guardian/core`, `@mcp-guardian/server`, `@mcp-guardian/cli` aligned to **2.9.3** with root.

## [2.9.2] - 2026-05-22

Enterprise findings closure ([`4649b48`](https://github.com/rudraneel93/mcp-guardian/commit/4649b48)) — see [`reports/enterprise-findings-fixes/summary.md`](reports/enterprise-findings-fixes/summary.md).

### Fixed
- **Enterprise findings (17/17 addressed)** — DPoP jti multi-Redis quorum (`GUARDIAN_DPOP_QUORUM_REDIS`), BK-tree typo-squat index, audit `blockReason` compaction, session rotation (`GUARDIAN_SESSION_ROTATE_ON_USE`), rate-limit / lock jitter; regression suite `tests/enterprise-findings-fixes.test.ts`.
- **M-2 prompt injection** — expanded regex on the sync default path; tier-2 LLM semantic audit via `GUARDIAN_SEMANTIC_ASYNC` for high-risk deployments ([docs/AI_LEARNING.md](docs/AI_LEARNING.md)).
- **Integration CI** — `tests/integration/mcp-fixtures.test.ts` excluded from default `pnpm vitest run`; run via `pnpm test:integration`.

### Changed
- **Adversarial harness metrics** — report artifact timestamps refreshed from local harness runs.
- **Workspace versions** — `@mcp-guardian/core`, `@mcp-guardian/server`, `@mcp-guardian/cli` aligned to **2.9.2** with root.

## [2.9.1] - 2026-05-21

Patch release after **2.9.0** CI hardening.

### Fixed
- **CI** — build `@mcp-guardian/plugin-sdk` before `tsc`, refresh Docker base image digest, drop Node 18 from smoke workflow.

### Changed
- **Workspace versions** — `@mcp-guardian/core`, `@mcp-guardian/server`, `@mcp-guardian/cli` aligned to **2.9.1** with root.

## [2.9.0] - 2026-05-20

Release focused on adversarial harness CI evidence, README evidence layers, and enterprise attack-simulation reporting.

### Added
- **Adversarial harness (CI-gated)** — `adversarial-harness/run-all.sh`, corpus + evasion bundles, Node live stdio proxy tests, Python policy mirror; reports under [`reports/adversarial-harness/`](reports/adversarial-harness/).
- **README evidence layers** — four-layer table (repo eval, adversarial harness, enterprise 5-scenario sim, 180-min SCA) with honest synthetic vs primary labeling.
- **Enterprise attack-simulation package** — five-scenario sim, dashboards, and analysis under [`reports/enterprise-attack-sim/`](reports/enterprise-attack-sim/).

### Metrics (from [`reports/adversarial-harness/summary.md`](reports/adversarial-harness/summary.md), 2026-05-20)
- **154/154** corpus attacks blocked; **74/74** benign pass; **0** false positives.
- **84/85** evasion blocked; **1** bypass (**adv-066** — base64-in-`search` documented in harness analysis).
- **26/26** Node integration tests; **400/402** (99.5%) Python/TS parity; **0** corpus parity mismatches.

### Fixed
- **Attack-learning auto-apply** — `attackMinConfidence()` enforced in `SuggestionEngine` auto-apply path (not at pattern suggestion time); restores high-confidence learned rules without dropping sub-threshold suggestions prematurely.
- **Policy allowlist test** — `enforceAllowlist: true` on tools allow fixture so block semantics match production policy.
- **Stdio proxy tests** — aligned with `RequestIdLock` (same id serialized, distinct ids may overlap); renamed suite and added parallel-id coverage.

### Changed
- **Workspace versions** — `@mcp-guardian/core`, `@mcp-guardian/server`, `@mcp-guardian/cli` aligned to **2.9.0** with root.

## [2.8.6] - 2026-05-20

Post-2.8.4 enterprise hardening, security fixes, and adversarial harness coverage.

### Added
- **Comprehensive adversarial test harness** — enterprise eval matrix, parity-by-id suites, orchestrator node test gate.
- **Policy strategies refactor** — HTTP API tests, semantic timeout tuning, disaster-recovery documentation.

### Fixed
- **P0–P3 full-stack review** — stdin serial queue, circuit breaker half-open probe, WebSocket proxy parity, JWT-authoritative tenant, OPA LRU cache.
- **71/100 review headline gaps** — async audit hot path, static imports on policy path, multi-tenancy docs and RBAC.
- **100% corpus attack block rate** — SQL/SSRF/prompt-injection/shell/path coverage gaps closed.
- **Enterprise readiness** — dashboard RBAC, streaming response inspection, local semantic fallback without LLM keys.
- **Enterprise spec alignment** — issues 1–6; secret scanner harness samples.
- **Full-stack critical security analysis** — ten priority items from security review.

## [2.8.4] - 2026-05-19

Enterprise hardening, tiered concurrent benchmarks, and proxy/SSE/WebSocket improvements (see `172abcd`).

### Fixed
- **SSE proxy** — `evaluateAsync()` for Redis rate limits and OPA; mTLS upstream via `createMtlsAgent()`.
- **Multi-replica attack learning** — PostgreSQL `ai_attack_learning_state_shared` via `AuditTrailSync`; file fallback when DB sync disabled.
- **Semantic layer visibility** — `semantic_layer_degraded` structured log + dashboard `logs:alert`; `GUARDIAN_SEMANTIC_STRICT` blocks when LLM unavailable.
- **Per-request proxy state** — `ProxyRequestContextStore` keyed by JSON-RPC id (concurrent `tools/call` safe).
- **GDPR erasure** — `eraseAllAuditData()` already purges `cost_records`, `security_scans`, `health_checks` (tests retained).
- **Postmark secret FP** — context-aware `postmark-api-token` matching.
- **PowerShell guards** — `Invoke-Expression`, `-EncodedCommand`, `[Convert]::FromBase64String` in shell tokenizer + policy path.
- **HTML entity normalization** — tests for `&lt;` / numeric entities in payload normalizer.

### Added
- **Migration runner** — `schema_migrations` table; ordered SQL in `src/database/migrations/`; wired into `postgres-db` and `AuditTrailSync`.
- **WebSocket MCP proxy** — foundational `WebSocketProxyServer` (JSON-RPC forward + policy on `tools/call`).
- **Dashboard API rate limiting** — Redis or in-process LRU (`GUARDIAN_DASHBOARD_API_RATE_LIMIT`, default 120/min).
- **Per-tenant circuit breakers** — `getCircuitBreaker(tenantId, serverName)` registry.
- **Load smoke test** — `benchmarks/concurrent-tool-calls.ts`.

### Environment
| Variable | Default | Purpose |
|----------|---------|---------|
| `GUARDIAN_SEMANTIC_STRICT` | `false` | Block `tools/call` when async semantic LLM unavailable |
| `GUARDIAN_DASHBOARD_API_RATE_LIMIT` | `120` | Dashboard REST API requests per minute per IP |
| `GUARDIAN_TENANT_ID` | `default` | Tenant isolation for circuit breakers, rate limits, attack learning PG row |

## [2.8.3] - 2026-05-18

### Documentation
- **Fig 4 omitted** from README — `fig4-cdf-time-to-suggestion.png` is a degenerate CDF (one point per category); use median time-to-suggestion in the metrics table instead.
- Removed **synthetic ROI** narrative and **CHART_10** references from README and related docs (prefer repo `reports/attack-learning-eval/metrics.json` for CI-aligned numbers).

## [2.8.2] - 2026-05-18

### Documentation
- Integrated **sca/** security & compliance analysis collateral into project docs — [sca/README.md](sca/README.md) index, chart catalog, and relationship to core proxy learning.
- Expanded [docs/AI_LEARNING.md](docs/AI_LEARNING.md) with evaluation methodology (`pnpm eval:attack-learning*`), figure interpretation (repo `fig1–fig7` + `sca/CHART_*`), and operational recommendations.
- Added [Attack learning evaluation](README.md#attack-learning-evaluation) section to root README (instant vs batch table, figure links).
- Extended [reports/attack-learning-eval/summary.md](reports/attack-learning-eval/summary.md) with per-figure interpretation; prefer `metrics.json` when numbers must align with CI.
- **Fig 4 omitted** from README, [docs/AI_LEARNING.md](docs/AI_LEARNING.md), and [reports/attack-learning-eval/summary.md](reports/attack-learning-eval/summary.md) — `fig4-cdf-time-to-suggestion.png` is a degenerate CDF (one point per category); use median time-to-suggestion in the metrics table instead.

## [2.8.1] - 2026-05-18

### Added
- **Per-block instant attack learning** — `recordBlockLearningEvent` updates rolling stats and `~/.mcp-guardian/.attack-learning-state.json` synchronously on every policy block; queues attack-pattern suggestions after N same (rule, tool) blocks within a sliding window (default 3 in 5 min).
- **Optional instant LLM classifier** — `GUARDIAN_AI_INSTANT_LLM=true` runs a rate-limited small classifier on critical blocks (`semantic-shell-guard`, `secret-scan`, `path-guard`).
- **Metrics** — `mcp_guardian_instant_learning_events_total`; structured log `instant_learning_event`.

### Changed
- **Proxy block path** — `recordDeniedCall` → `recordBlockLearningEvent` (instant stats + debounced full cycle).
- **Attack pattern learner** — incremental `suggestFromBlockedGroup` for instant and batch paths.

### Environment
| Variable | Default | Purpose |
|----------|---------|---------|
| `GUARDIAN_AI_INSTANT_LEARNING` | on (with AI) | Sync per-block stats + suggestion queue |
| `GUARDIAN_AI_INSTANT_WINDOW_MS` | `300000` | Sliding window for repeat-block detection |
| `GUARDIAN_AI_INSTANT_LLM` | `false` | LLM classifier on critical blocks |
| `GUARDIAN_AI_INSTANT_LLM_RATE_MS` | `60000` | Global LLM rate limit per block path |
| `GUARDIAN_AI_ATTACK_STATE_PATH` | `~/.mcp-guardian/.attack-learning-state.json` | Instant learning state file |
| `GUARDIAN_AI_BLOCK_DEBOUNCE_MS` | `30000` | Set `0` for immediate full learning cycle after each block |

## [2.8.0] - 2026-05-18

### Production hardening bundle

Resolves and documents all production blockers in [docs/PRODUCTION_BLOCKERS.md](docs/PRODUCTION_BLOCKERS.md).

### Fixed
- **LRU memory leaks** — `updateAgeOnGet: false` on `llm-cache`, CVE cache, dashboard login limiter, and session/nonce caches (LRU max 10k / 50k with periodic sweep).
- **Session cache** — Replaced unbounded `Map` with bounded LRU for long IDE sessions.

### Added
- **Policy engine memory test** — `tests/policy/policy-engine-memory.test.ts` (120k unique clients, cache stays at max).
- **PgBouncer strict-mode test** — Fail startup when `GUARDIAN_STRICT_MODE` + `REPLICA_COUNT` > 50 and direct `:5432`.
- **DPoP concurrent claims** — 100-way race + 50 distinct jtis in `tests/auth/dpop-redis-lock.test.ts`.
- **Cost audit default** — Explicit test that `allowsCostEstimates()` is false without `GUARDIAN_COST_ALLOW_ESTIMATES`.
- **`@mcp-guardian/plugin-sdk`** — `publishConfig`, `prepublishOnly` build; monorepo `workspace:*` documented in [docs/PLUGIN_SDK.md](docs/PLUGIN_SDK.md).

## [2.7.11] - 2026-05-18

### Changed
- **Cost auditor — actual vs estimated** — Audit/report without proxy `call_records` no longer fabricates per-tool token volumes from `tools/list`. Reports **`model-only`**: resolved model, official list rates (`$`/M input/output), **$0 measured** until traffic goes through `mcp-guardian proxy`. Measured usage uses **`costSource: actual`** from proxy records.
- **`costSource` values** — `actual` (proxy records), `model-only` (rates only), `estimated` (legacy simulation, opt-in), `none`.
- **Model discovery** — `resolveModelIdForServer()` reads server `env`, `--model` in `args`, `GUARDIAN_MODEL_<SERVER>`, `CURSOR_MODEL` / `CLINE_MODEL`, and Cline `globalState.json` act-mode model; documented chain in `src/config/llm-config.ts`.
- **Proxy call records** — Persist `model` on each record via `resolveModelIdForServer` when message metadata has no model.

### Added
- **`GUARDIAN_COST_ALLOW_ESTIMATES=true`** — Opt-in to previous tools/list simulation (`costSource: estimated`).
- **`resolveModelListRates()`** — List-price preview without simulated call volume.

## [2.7.10] - 2026-05-18

### Fixed
- **Cost auditor in audit/scan/report modes** — `mcp-guardian audit` and `report` no longer return empty costs when proxy `call_records` are absent. Connects via `tools/list`, simulates per-tool `tools/call` token footprint with `TokenCounter` + `RuntimeModelPricing`, and persists estimates to `cost_records`.

### Added
- **`resolveModelIdForServer()`** — Per-server model from server `env`, `GUARDIAN_MODEL_<SERVER>`, or global `GUARDIAN_LLM_MODEL` / `GUARDIAN_MODEL`.
- **`src/utils/cost-estimate.ts`** — Schema-based minimal args and per-tool cost breakdown for audit mode.
- **Cost report metadata** — `costSource` (`proxy-records` | `estimated` | `none`), `modelId`, `provider`, `priced` on `CostReport`.

### Tests
- `tests/services/cost-auditor-audit-mode.test.ts`, `resolveModelIdForServer` in `tests/config/llm-config.test.ts`.

## [2.7.9] - 2026-05-18

### Fixed (enterprise security analysis remediation)
- **LRU cache TTL** — `updateAgeOnGet: false` on policy and per-client rate limit caches so hot keys cannot pin entries indefinitely during 8+ hour IDE sessions.
- **DPoP Redis replay** — Short-lived distributed lock around `SET NX` jti claims for multi-replica HA (`claimDpopJtiOnRedis`).
- **Memory monitoring** — Periodic heap/RSS warnings in long-running proxy (`GUARDIAN_MEMORY_MONITOR=false` to disable).
- **PostgreSQL pool** — Configurable `GUARDIAN_PG_POOL_MAX` (default 10); Helm sets `4` per replica when using PgBouncer.
- **Docker reproducibility** — Pin `node:20-alpine` image digest in `Dockerfile`.
- **PowerShell launcher** — `try/catch`, CLI path check, and `ValueFromRemainingArguments` arg forwarding.

### Added
- **Audio token estimates** — `estimateAudioTokens` / `countAudioTokensInPayload` (~25 tokens/sec heuristic) in cost path.
- **Helm PgBouncer guard** — `pgbouncer.requireGuardianEnforcement` sets `GUARDIAN_REQUIRE_PGBOUNCER` for Postgres deployments.
- **CI lockfile gate** — `git ls-files --error-unmatch pnpm-lock.yaml` in CI.

### Tests
- `tests/auth/dpop-redis-lock.test.ts`, `tests/utils/memory-monitor.test.ts`, `tests/cost/multimodal-audio.test.ts`.

## [2.7.8] - 2026-05-18

### Fixed (security review P0/P1)
- **Request timeout** — `tools/call` upstream waits enforce `requestTimeoutMs`; hung upstream returns JSON-RPC `-32006`, records denied call, clears pending slot (`src/proxy/proxy-server.ts`).
- **Redis rate-limit failover** — On Redis errors, log `redis_rate_limit_degraded` and fall back to in-process LRU limiter (never skip rate limits entirely) (`src/policy/policy-engine.ts`).
- **Rug-pull blocking** — Tool fingerprint mismatch blocks subsequent `tools/call` and rejects mutated `tools/list` notifications (OWASP MCP03).
- **Subdomain squatting** — Registrable-domain (eTLD+1) checks block trusted-domain suffix squats like `nvd.nist.gov.attacker.io` (`src/utils/registrable-domain.ts`, `url-guard`, prompt-injection exfiltration).
- **Multi-tool-chaining FP** — Tighter regex avoids flagging numbered search result lists (`src/scanners/prompt-injection-detector.ts`).

### Added
- **OAuth stdio token paths** — `OAuthValidator.extractAuthFromMcpMessage()` reads initialize metadata, JSON-RPC root `Authorization`, `_meta.auth`, and env tokens (`src/auth/oauth.ts`).
- **Corpus CI gates** — Minimum entry count from `corpus/manifest.yaml`, F1 floor (`CORPUS_MIN_F1`, default 85%), minimum attack sample count (`CORPUS_MIN_ATTACK_SAMPLES`, default 50).
- **Per-client rate limit keys** — `tenant:server:tool:clientId` when identity is present (`policy-engine`, proxy per-client limiter).

### Tests
- `tests/proxy/request-timeout.test.ts`, `tests/proxy/rug-pull-block.test.ts`, `tests/policy/redis-rate-limit-fallback.test.ts`, `tests/auth/oauth-stdio-extract.test.ts`, `tests/policy/subdomain-squatting.test.ts`, `tests/scanners/multi-tool-chaining-fp.test.ts`, `tests/utils/registrable-domain.test.ts`.

## [2.7.7] - 2026-05-17

### Fixed
- **Dashboard SPA hydration** — Replaced preview-only static stub with a Next.js App Router client (`deploy/dashboard-spa/`) using client-only mount, error boundary, and graceful handling when the Guardian API on port 4000 is unavailable. Static export served from `out/` (legacy HTML/JS fallback when not built).

### Added
- `pnpm dashboard:build` / `pnpm dashboard:dev` — build or develop the browser dashboard.
- `tests/dashboard/dashboard-spa.test.ts` — structure smoke tests for the dashboard app.

## [2.7.6] - 2026-05-17

### Added
- **Cost governance template** — `policy-templates/enterprise-cost-governance.yaml` + `policy-templates/README.md` (rate limits, token budgets, `GUARDIAN_DAILY_BUDGET_USD`).
- **DPoP enforcement** — `GUARDIAN_REQUIRE_DPOP=true` rejects requests without valid proof (`src/auth/dpop-enforcement.ts`); Helm `dpop.require`.
- **Redis HA** — Sentinel (`REDIS_SENTINELS`, `REDIS_SENTINEL_MASTER_NAME`) and Cluster (`REDIS_CLUSTER_NODES`) via `src/utils/redis-client.ts`; [docs/REDIS_HA.md](docs/REDIS_HA.md).
- **Production auth guide** — [docs/PRODUCTION_AUTH.md](docs/PRODUCTION_AUTH.md) (DPoP + mTLS).
- **Helm mTLS** — `templates/mtls-secret.yaml`, volume mounts, `mtls.enabled` values.
- **Docker supply chain** — non-root `USER 1001`, `scripts/verify-docker-prebuilds.sh`, docker-publish smoke test as uid 1001.

### Changed
- `CostAuditor` — `getDailySpendUsd()`, `isDailyBudgetExceeded()`, `GUARDIAN_DAILY_BUDGET_USD` env.
- DPoP nonce store, rate limiter, LLM cache, session cache use shared Redis client factory.

### Tests
- `tests/policy/cost-governance.test.ts`, `tests/auth/dpop-require.test.ts`, `tests/utils/redis-client.test.ts`, `tests/utils/mtls-config.test.ts`.

## [2.7.5] - 2026-05-17

### Added
- **Enterprise LLM/MCP corpus** — 226 real attack fixtures under `corpus/` (benign, prompt-injection, credential-exfil, sql-nosql, ssrf-url, shell-obfuscation, cross-tool-chain, edge-cases); `corpus/manifest.yaml`, `corpus/README.md`.
- **Corpus eval** — `corpus/run-eval.ts` runs each entry through `PolicyEngine` + `default-policy.yaml`; per-category precision/recall; writes `corpus-eval-report.json`; fails CI on missed attacks.
- **Benchmarks in CI** — `benchmarks` job in `.github/workflows/ci.yml`; p95 gate via `BENCH_P95_THRESHOLD_MS`; `benchmarks/README.md`.
- **E2E adversarial proxy** — `tests/e2e/adversarial-proxy.e2e.test.ts` (10 corpus attacks through live proxy).
- **Pen-test artifacts** — `docs/PEN_TEST_REPORT.md`, `security/ATTACK_MATRIX.md`, `scripts/generate-pen-test-report.cjs`.

### Changed
- Corpus eval workflow (PR + nightly) uploads `corpus-eval-report.json`.
- `pnpm eval` uses PolicyEngine (replaces legacy `scanTool` poisoned/benign layout).

## [2.7.4] - 2026-05-17

### Added
- **Redis LLM cache (ARCH-4)** — `src/ai/llm-cache.ts` with Redis-backed responses and in-memory LRU fallback; keys hash `model + system + prompt + temperature`; metrics `mcp_guardian_llm_cache_hits_total` / `mcp_guardian_llm_cache_misses_total`.
- **Centralized LLM config (CQ-3)** — `src/config/llm-config.ts` (`getLlmConfig`, `resolveModelId`) replaces scattered hardcoded models/token limits in semantic scan, `LlmAssistant`, proxy cost path, and suggestion engine.

### Changed
- Semantic scanner (`packages/core`) and async semantic audit / Ollama assistant use shared cache + config.
- Env: `GUARDIAN_LLM_CACHE`, `GUARDIAN_LLM_CACHE_TTL_SEC`, `GUARDIAN_LLM_PROVIDER`, `GUARDIAN_LLM_MODEL`, `GUARDIAN_LLM_MAX_TOKENS`, `GUARDIAN_LLM_TEMPERATURE`, `OLLAMA_BASE_URL`.

### Tests
- `tests/ai/llm-cache.test.ts`, `tests/config/llm-config.test.ts`.

## [2.7.3] - 2026-05-17

### Fixed (critical code review + complete analysis reports)
- **Config path security** — `sanitizeConfigPath` uses `realpath`, `/root/`/`/srv/`/`/data/` allowlist, Windows drive prefixes; blocks symlink escape (`src/utils/sanitize-config-path.ts`).
- **MCP server DB default** — `~/.mcp-guardian/mcp-server.db` instead of macOS-only `/private/tmp` (still separate from proxy `history.db` for Cline lock isolation).
- **Package version** — MCP server advertises `readPackageVersion()` from `package.json` (no stale `2.3.4` fallback).
- **Scan engine** — Regex + schema layers run in parallel via `Promise.all` (`packages/core/src/engine.ts`).
- **WSL2 paths** — `/mnt/c/...` and `\\wsl$\...` normalization in path guard (`src/utils/wsl-path.ts`).

### Security / compliance
- **DPoP** — Concurrent replay regression test for in-memory nonce store (Redis path already uses `SET NX`).
- **GDPR erase** — Post-erasure row-count assertion; COMPLIANCE.md documents WAL/backup forensic limits.

### CI
- **Supply chain** — `osv-scanner` on `pnpm-lock.yaml` in `.github/workflows/supply-chain.yml`.

### Docs
- [docs/WINDOWS.md](docs/WINDOWS.md) — WSL2 path mapping section.

### Tests
- `tests/utils/sanitize-config-path.test.ts`, `tests/utils/wsl-path.test.ts`, `tests/utils/guardian-db-path.test.ts` (mcp-server.db), `tests/auth/dpop-nonce-store.test.ts`, `tests/database/gdpr-erase.test.ts`, `packages/core/tests/engine.test.ts`.

## [2.7.2] - 2026-05-17

### Added
- **Secret scanner** — Expanded from ~35 to **267** industry-standard detection patterns (Gitleaks/TruffleHog-class coverage): cloud (AWS, GCP, Azure, DigitalOcean, Cloudflare, Heroku), VCS/CI (GitHub, GitLab, Bitbucket, CircleCI, Travis, Jenkins), chat webhooks (Slack, Discord, Telegram, Teams), payments (Stripe, Square, PayPal, Braintree), email/SMS (SendGrid, Mailgun, Twilio, Postmark), AI providers (OpenAI, Anthropic, HuggingFace, Cohere, Replicate, Groq), databases (postgres, mysql, mongodb, redis, amqp, jdbc), crypto keys, OAuth/JWT/session tokens, package registries (npm, PyPI, RubyGems, NuGet), and generic high-entropy assignments.
- `getSecretRuleCount()` export for transparency; rules live in `src/scanners/secret-rules.ts` with pre-compiled regex at module load.

### Tests
- `tests/secret-scanner-coverage.test.ts` — asserts ≥150 rules and spot-checks 20 provider categories.

## [2.7.1] - 2026-05-17

### Fixed (developer deep-dive review)
- **Secret scanner** — Confirmed 35+ regex rules in source (reviewer tarball was stale); added tests for `postgresql://` URLs and `DATABASE_URL` env values.
- **Storage docs** — Clarified **better-sqlite3** (WAL + `busy_timeout=5000`), not `sql.js`; [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **SSE coverage** — Structured `sse_untracked` warning, `untrackedSse` on security scan reports, Prometheus `mcp_guardian_sse_untracked_servers`.
- **SSE response inspection** — `evaluateResponse` + prompt-injection blocking on `SseProxyServer` (parity with stdio proxy).
- **README** — Token counts documented as approximate unless API `usage` is returned.

### Tests
- `tests/secret-scanner.test.ts` (postgres URL, rule-count probe), `tests/policy/adversarial-scenarios.test.ts` (malicious response), `tests/services/security-scanner.test.ts` (`untrackedSse`).

## [2.7.0] - 2026-05-17

### Added (enterprise readiness)
- **Detector Plugin SDK v3.0** — `@mcp-guardian/plugin-sdk` with `createDetectorPlugin`, lifecycle hooks (`onLoad`/`onUnload`); plugins on by default (`GUARDIAN_PLUGINS_ENABLED=false` to disable). See [docs/PLUGIN_SDK.md](docs/PLUGIN_SDK.md).
- **HTTP tools policy template** — `policy-templates/http-tools-policy.yaml`; merge with `GUARDIAN_HTTP_TOOLS_POLICY=true`.
- **Browser dashboard SPA** — `deploy/dashboard-spa/` (REST + WebSocket); served at `/` when present (`GUARDIAN_DASHBOARD_SPA=false` for legacy page).
- **Fleet CLI** — `mcp-guardian fleet status` (Postgres `guardian_instances` or `GUARDIAN_FLEET_DB_PATHS`); TUI **Fleet** tab (key 9).
- **Multi-region** — `GUARDIAN_REGION` labels; Redis rate-limit keys per region; optional `GUARDIAN_RATE_LIMIT_DISTRIBUTED_LOCK`. [docs/MULTI_REGION.md](docs/MULTI_REGION.md) (active-passive, not active-active).
- **Async semantic audit** — queue cap, min confidence, Prometheus metrics (`mcp_guardian_semantic_audit_*`). [docs/AI_LEARNING.md](docs/AI_LEARNING.md).
- **Windows installer** — Inno Setup script `installer/windows/mcp-guardian.iss` + build docs.

### Tests
- `tests/policy/policy-merge.test.ts`, `tests/plugins/plugin-sdk.test.ts`, `tests/fleet/fleet-status.test.ts`, `tests/utils/region.test.ts`.

## [2.6.8] - 2026-05-17

### Security (58-scenario adversarial report)
- **URL guard** (`src/policy/url-guard.ts`) — blocks metadata IPs, `file://` / `javascript:` / `data:`, private IPs, decimal IP localhost, `[::1]`, and webhook/callback SSRF; wired into semantic guards for puppeteer and all `url`/`href`/`target`/`webhook`/`callback` fields.
- **Sensitive paths** — docker.sock, Kubernetes service-account secrets, `terraform.tfstate`, `.npmrc`, `.git-credentials`, `.vault-token`, service-account JSON patterns.
- **`evaluateResponse`** — null/undefined-safe (no crash on `matchAll`).
- **SQL / NoSQL / GraphQL / LDAP** — expanded semantic and YAML patterns (`UNION…SELECT`, `LOAD_FILE`, `SLEEP`, `benchmark`, `$where`, `__schema`, LDAP filters).
- **SSTI & prompt injection** — `{{`, `${`, `<%`, `#{` in arguments; zero-width strip before injection detect; multi-line injection patterns.
- **`default-policy.yaml`** — `block-dangerous-urls` rule; expanded path/SQL/shell patterns.

### Tests
- `tests/policy/adversarial-scenarios.test.ts`, `tests/policy/url-guard.test.ts`.

## [2.6.7] - 2026-05-17

### Fixed (MASTER test report)
- **Cost pricing recursion** — `resolveModelId` no longer calls `getActivePricing()` (breaks `detectActivePricing` ↔ `resolveModelId` stack overflow when only env/Cline model id is set).
- **Proxy response observability** — `response_sent` structured event when upstream JSON-RPC is written to the IDE client.

### Added
- **GDPR Article 17** — `HistoryDatabase.eraseAllAuditData()` wipes all audit tables; documented in [docs/COMPLIANCE.md](docs/COMPLIANCE.md) with retention defaults.

### Tests
- `tests/services/runtime-model-pricing.test.ts`, `tests/database/gdpr-erase.test.ts`.

## [2.6.6] - 2026-05-17

### Fixed (comprehensive real test report)
- **Integration stability** — `proxy-audit` uses `benchmarks/fixtures/integration-mcp-server.cjs` (fixes inline `-e` mock crash / zero-token flakes); `real-mcp-server` keeps trailing newlines and longer waits for slow CI VMs.
- **DPoP multi-replica** — `REDIS_URL` enables Redis `SET NX` jti deduplication (`src/auth/dpop-nonce-store.ts`); in-memory store unchanged for single instance.

### Security (dev supply chain)
- **Vitest 3** + pnpm overrides `vite>=6.4.2`, `esbuild>=0.25.0` — resolves moderate dev-only audit findings.

### Docs
- **[docs/COMPLIANCE.md](docs/COMPLIANCE.md)** — HIPAA at-rest, GDPR purge, DPoP Redis documented honestly.

## [2.6.5] - 2026-05-16

### Fixed (IDE long-running / concurrency)
- **Metrics lifecycle** — `shutdownMetrics()` / `dispose()` closes the Prometheus HTTP server, clears maintenance intervals, and resets the registry; invoked on proxy shutdown, TUI exit, and dashboard close.
- **SQLite contention** — `persistCallRecord` retries on `SQLITE_BUSY` (3 attempts, exponential backoff); WAL + `busy_timeout=5000` confirmed for all writers sharing `MCP_GUARDIAN_DB_PATH`.
- **Remote SSH paths** — `src/utils/remote-path.ts` maps local IDE paths to remote workspace paths (`GUARDIAN_REMOTE_SSH`, `GUARDIAN_REMOTE_PATH_MAP`); wired into path-guard and `wrap`.

### Docs
- **[docs/REMOTE_SSH.md](docs/REMOTE_SSH.md)** — VS Code Remote SSH setup.
- **[docs/DEVCONTAINERS.md](docs/DEVCONTAINERS.md)** — Dev container bind mount and shared DB path.

### Tests
- `tests/utils/metrics-dispose.test.ts`, `tests/utils/remote-path.test.ts`, `tests/database/sqlite-busy-retry.test.ts`.

## [2.6.4] - 2026-05-16

### Fixed (extensibility / Test 8)
- **OPA precedence** — OPA/Rego block always wins over YAML pass; both deny → OPA reason; OPA unavailable falls through to YAML (`resolvePolicyPrecedence`, `evaluateAsync`).
- **Hot reload** — `PolicyWatcher` builds pending engine off the event loop, atomic swap; no evaluate-time lock or "reload in progress" blocks.
- **Detector plugins (experimental v0.1)** — `DetectorPlugin` registry, `GUARDIAN_PLUGINS_ENABLED`, optional `GUARDIAN_PLUGIN_PATH` dynamic load.

### Docs
- **[docs/POLICY.md](docs/POLICY.md)** — Evaluation order: OPA block → YAML → `default_action`.
- **[docs/EXTENSIBILITY.md](docs/EXTENSIBILITY.md)** — Honest status; full SDK v3.0 planned.
- **Example** — `examples/plugins/custom-secret-pattern.js`.

### Tests
- `tests/policy/opa-precedence.test.ts`, `tests/policy/policy-watcher-reload.test.ts`, `tests/plugins/detector-plugin.test.ts`.

## [2.6.3] - 2026-05-16

### Added (Windows)
- **`guardian-proxy.ps1`** — Native PowerShell stdio proxy launcher (repo root + `scripts/`); quotes `node`/`dist/cli.js` paths for usernames and install dirs with spaces.
- **`mcp-guardian wrap` on win32** — Generates `powershell.exe -File guardian-proxy.ps1` entries instead of `guardian-proxy.sh`; Windows client config paths for Cline/Claude Desktop.
- **`src/utils/windows-paths.ts`** — `quotePathForPowerShell`, `resolveGuardianProxyWrapper`, `buildWrappedMcpServerEntry`.
- **`scripts/postinstall-windows.cjs`** — Warns when `better-sqlite3` fails to load on Windows.
- **`installer/README.md`** — MSI installer roadmap (planned v2.7).
- **Tests** — `tests/utils/windows-paths.test.ts`.

### Docs
- **`docs/WINDOWS.md`** — Native PowerShell setup, better-sqlite3 prebuild notes, Cursor example config, MSI roadmap.

## [2.6.2] - 2026-05-16

### Docs (scale & HA)
- **PgBouncer mandatory** — [docs/SCALE_AND_RESILIENCE.md](docs/SCALE_AND_RESILIENCE.md): 100-replica chaos test; required for production >50 replicas or any multi-replica K8s with Postgres; direct `:5432` exhausted `max_connections` at 87 replicas.
- **Cross-region** — Documented: no multi-region active-active yet; >80ms Redis RTT breaks lock semantics.
- **RUNBOOK** — PgBouncer connection strings, backup restore (4m12s / 2.3GB validated), Redis Sentinel AZ failover (RTO 47s, RPO 3s).
- **Helm** — `pgbouncer.enabled: true`, `postgres.maxConnections: 300` comments in values.yaml.

### Added
- **`GUARDIAN_REQUIRE_PGBOUNCER`** — Exit at startup if `DATABASE_URL` is not pooler-shaped; warn on direct `:5432` in K8s/multi-replica Postgres.
- **Tests** — `tests/utils/pgbouncer-check.test.ts`.

## [2.6.1] - 2026-05-16

### Fixed (cost governance accuracy)
- **Provider-aware tokenization** — `detectProvider()` routes OpenAI to tiktoken, Anthropic to optional `@anthropic-ai/tokenizer` or chars÷3.5 heuristic (no OpenAI BPE on Claude).
- **API usage** — Proxy prefers `usage.input_tokens` / `output_tokens` from responses; `tokenSource: api | estimated` on call records; warns when estimate vs API drift >5%.
- **Multimodal** — Image tokens via `(width × height) / 750` added to request counts.
- **Docs** — [docs/COST_GOVERNANCE.md](docs/COST_GOVERNANCE.md) (drift expectations, USD-only currency).
- **Tests** — `tests/utils/token-counter.test.ts`, `tests/cost/multimodal-tokens.test.ts`.

## [2.6.0] - 2026-05-16

### Security (AI learning anti-poisoning)
- **Label quorum** — Weight/threshold changes require ≥2 distinct labelers or ≥10 weighted labels per fingerprint; below quorum logs `learning_quorum_pending` (`GUARDIAN_AI_MIN_DISTINCT_LABELERS`, `GUARDIAN_AI_MIN_TOTAL_LABELS`).
- **Reputation weighting** — `GUARDIAN_AI_LABEL_WEIGHT`, `GUARDIAN_AI_ADMIN_USERS`; burst cap (3 labels/hour/user/fingerprint counts as one).
- **Drift detection** — `drift-detector.ts` compares 7d vs prior 7d token/block-rate stats; freezes auto threshold tuning until `GUARDIAN_AI_DRIFT_OVERRIDE=true`.
- **Rollback** — Snapshots before weight-apply cycles; `mcp-guardian ai rollback`, `POST /api/ai/rollback`; auto-rollback if precision proxy drops >10%.
- **FP whitelist hardening** — Blocks coordinated single-user promotion (5 confirms/1h); dangerous `curl|wget|rm` unblocks require quorum.
- **Tests** — `tests/ai/learning-poisoning.test.ts`, `tests/ai/drift-detector.test.ts`, `tests/ai/fp-whitelist-poisoning.test.ts`.

## [2.5.9] - 2026-05-16

### Security (OWASP ASVS dashboard auth)
- **CSRF** — Double-submit cookie (`mcp_guardian_csrf`) + `X-CSRF-Token` + Origin/Referer validation on POST/PUT/DELETE/PATCH; `GET /api/auth/csrf`; skipped when `DASHBOARD_AUTH_DISABLED=true`.
- **Session fixation** — Login revokes prior `mcp_guardian_session`, always issues fresh token with new `jti`; cookie + Bearer session auth.
- **mTLS** — [docs/MTLS.md](docs/MTLS.md) (honest hot-reload status); `mtls-watcher.ts` skeleton; Helm placeholder comment (pod restart until reload ships).
- **DPoP** — Documented `jti` replay protection; `tests/auth/dpop.test.ts`.

## [2.5.8] - 2026-05-16

### Security (supply chain hardening)
- **`better-sqlite3` ^12.10.0** — Bundled SQLite 3.53.x (≥ 3.50.2) for inherited SQLite CVE mitigation.
- **`jose` ^6.2.3** — Already ≥ 4.15.5 (CVE-2024-28176); documented minimum in SECURITY.md.
- **Typo-squat** — `MALICIOUS_PACKAGE_WATCHLIST` (`pino-sdk-v2`); trusted `@mcp-guardian/cli` and `pino` for lookalike detection.
- **CI** — `supply-chain.yml` audit + CycloneDX SBOM; cosign image signing on GHCR publish; `attest-build-provenance` on npm release artifacts.
- **Docs** — [docs/SUPPLY_CHAIN.md](docs/SUPPLY_CHAIN.md) (lockfile policy, SQLite upgrade path, signing status).

### Changed
- Version **2.5.8**; `pnpm audit --audit-level=high` enforced in CI (moderate dev-only advisories may remain).

## [2.5.7] - 2026-05-16

### Security
- **Unicode TR39 confusables** — Full `confusables.txt` (UTS #39) loaded at startup; `normalizeConfusables()` runs before NFKC in payload normalization and recursive de-obfuscation (~96% detection on homoglyph shell bypass suite vs ~71% with NFKC + Cyrillic fold alone).
- **Policy flag `unicode_strict`** — `policy.unicode_strict` (default `true` in `default-policy.yaml`, `false` in `policy-demo.yaml`). When `false`, skips TR39 confusables pass for international tool arguments.

### Added
- **`assets/confusables.txt`** — Shipped in npm package (`files` includes `assets/`).
- **Tests** — `tests/utils/confusables.test.ts`, `tests/fixtures/confusables-suite.json`, `tests/utils/confusables-suite.test.ts`.

## [2.5.6] - 2026-05-16

### Added
- **Recursive de-obfuscation** — `deobfuscateRecursive()` in payload normalizer (base64, URL, hex, unicode, HTML) before prompt-injection and semantic guards.
- **Async LLM semantic audit** — Post-hoc `tools/call` queue (`GUARDIAN_SEMANTIC_ASYNC`, default on when LLM enabled); sync path stays regex/semantic only; flags via `async_semantic_flag` structured log.
- **FP auto-whitelist** — Three dashboard/TUI false-positive confirmations persist to `~/.mcp-guardian/.fp-whitelist.json` (`GUARDIAN_FP_WHITELIST_THRESHOLD`).
- **Policy playground CLI** — `mcp-guardian policy test --policy … --tool … --args '{…}'` prints decision JSON.
- **Windows notes** — `docs/WINDOWS.md` (paths, limitations, named-pipes TODO).

### Env
- `GUARDIAN_SEMANTIC_ASYNC`, `GUARDIAN_SEMANTIC_DEBOUNCE_MS`, `GUARDIAN_FP_WHITELIST_THRESHOLD`, `GUARDIAN_FP_WHITELIST_PATH`

## [2.5.5] - 2026-05-16

### Added
- **Attack-driven learning** — Debounced learning cycle on proxy blocks (`onPolicyBlock`); `attack-pattern-learner` heuristics from blocked `call_records`; manual accept applies rules via `policy-applier` + PolicyWatcher hot-reload.
- **Policy decision ingestion** — Proxy records pass/block/flag decisions into `DataCollector`; learning metadata uses blocked rows from SQLite.
- **Live attack matrix** — Post-proxy learning assertion in `scripts/run-live-attack-matrix.cjs`.
- **Tests** — `tests/ai/attack-driven-learning.test.ts`.

### Env
- `GUARDIAN_AI_BLOCK_DEBOUNCE_MS` (default `30000`), `GUARDIAN_AI_ATTACK_MIN_BLOCKS` (default `3`).

## [2.5.4] - 2026-05-16

### Security (FINCO / semantic abuse)
- **Semantic guards at proxy** — Sensitive paths (`.ssh`, `.env`, `/`, `/etc`), SQL bulk-exfil patterns, GitHub write tools denied, prompt-injection in args, PowerShell `-enc`.
- **Path workspace scoping** — `GUARDIAN_WORKSPACE` / `GUARDIAN_ALLOWED_PATH_PREFIXES` restrict filesystem tools to project dirs.
- **GitHub repo allowlist** — `GUARDIAN_GITHUB_ALLOWED_ORGS` / `GUARDIAN_GITHUB_ALLOWED_REPOS`.
- **Homoglyph folding** — Cyrillic/Greek lookalikes normalized before regex (e.g. `/etс/passwd`).
- **Proxy entropy DLP** — High-entropy / base64 blobs blocked in `block` mode (`GUARDIAN_PROXY_ENTROPY=false` to disable).
- **default-policy.yaml** — Deny GitHub mutations; sensitive path argPatterns; SQL exfil rules; read-only allowlist (no `write_to_file`).
- **Tests** — `tests/policy/finco-attack-chain.test.ts` reproduces the full FINCO chain.

## [2.5.3] - 2026-05-16

### Security (production hardening)
- **CVE gate opt-in** — `GUARDIAN_BLOCK_ON_CVE` defaults to off; when enabled, blocks CRITICAL CVEs only (set `GUARDIAN_CVE_BLOCK_SEVERITY=HIGH` to widen).
- **Dashboard fail-closed** — Auth required by default when dashboard is on; requests rejected if `DASHBOARD_API_KEY` / `DASHBOARD_JWT_SECRET` missing (`DASHBOARD_AUTH_DISABLED=true` for local dev only).
- **Proxy stdout** — Pino/structured logs go to stderr so MCP JSON-RPC on stdout is not corrupted.
- **OSV severity parser** — Handles string, array, and object severity shapes (fixes silent scan failures).
- **CLI version** — Reads from `package.json` (no hardcoded drift).
- **`--blocking-mode`** — Applies unless `GUARDIAN_DISALLOW_MODE_OVERRIDE=true`.
- **AI on CLI** — Learning on `scan`/`audit`/`health`/`report` only when `GUARDIAN_AI_ON_CLI=true`.
- **Typo-squat** — Tail-segment matching (e.g. `server-githhub`).
- **Secret scanner** — Dedupes overlapping rule hits per scan.
- **npm tarball** — Ships `deploy/dashboard.html`; dashboard loader searches multiple paths.

### Dependencies
- **pnpm override** — `protobufjs>=8.0.2` to reduce transitive HIGH advisories from OpenTelemetry.

## [2.5.2] - 2026-05-16

### Added
- **TUI-first observability** — Read-only SQLite access while proxy writes; per-server Instances tab; live FULL ANALYSIS from `call_records` (not stale `.ai-report.json`).
- **`mcp-guardian doctor`** — Checks DB path, policy, and AI flags.
- **`pnpm run live:tui-demo`** — Multi-server corpus replay into shared `history.db` for local TUI smoke tests.
- **Dogfood CI** — Sandboxed scenario in GitHub Actions; `scenarios/dogfood/` harness and enterprise stub.
- **Shared DB utilities** — `guardian-db-path`, `db-aggregate`, CVE gate, preflight scan, runtime model pricing, WebSocket dashboard events.

### Fixed
- **SQLite concurrency** — TUI opens canonical DB read-only; secondary writers share WAL + `busy_timeout` instead of forked `history-<pid>.db` files.
- **Dashboard EADDRINUSE** — Proxy continues if port 4000 is busy (warns; WS optional).
- **AI learning** — Persists cycle state and baselines; preventive suggestions when traffic is stable; learning on by default (`GUARDIAN_AI_ENABLED=false` to disable).
- **TUI poll** — 1.5s refresh with read-only reconnect; dashboard metrics no longer zero live DB counts.

### Docs
- README: honest TUI limitations, live-update troubleshooting, `live:tui-demo` vs dogfood vs production wrap.

## [2.5.1] - 2026-05-16

### Fixed (dogfood / observability)
- **Denied call records** — Policy and DLP blocks are persisted to `history.db` with `blocked`, `block_rule`, and `block_reason` for audit/TUI/dashboard accuracy.
- **Policy rule order** — `deny-dangerous-tools` runs before allowlist; path-traversal (`..`) runs before shell-injection; `/etc/passwd` removed from shell patterns so traversal attribution is correct.
- **`flag` in block mode** — Rate-limit and token-budget `flag` rules now deny requests when policy mode is `block`.
- **DLP error shape** — Secret blocks return consistent `Blocked by MCP Guardian policy` message with `data.rule: secret-scan`.
- **Dogfood harness** — Full CLI corpus replay per server, expected-rule assertions, DB blocked-count gate, Phase 4 summary output.

### Fixed (P0 — security audit)
- **AWS DLP** — Secret scanner entropy check now runs on the full matched secret, not a 4-char prefix capture group; AWS access keys (e.g. `AKIAIOSFODNN7EXAMPLE`) are detected again.
- **Fail-closed default policy** — `default-policy.yaml` uses `default_action: block` with an explicit tool allowlist.
- **Multi-stdio guard** — Proxy CLI exits with an error when multiple stdio servers are configured in one process (prevents stdin broadcast).
- **`--blocking-mode`** — Mode override applies in memory only; no longer rewrites the policy YAML on disk.

### Security
- Bump `@modelcontextprotocol/sdk` to ^1.25.2 (resolves ReDoS and related advisories in the pinned 1.0.x line).

## [2.3.24] - 2026-05-14

### Fixed
- **DB lock isolation** — `HistoryDatabase` constructor (line 73) now reads `MCP_GUARDIAN_DB_PATH` env var as fallback, enabling multiple concurrent proxy instances with separate databases
- **container.ts** — `createContainer()` respects `MCP_GUARDIAN_DB_PATH` for all CLI commands (scan, audit, health, report, proxy), preventing lock conflicts when proxies are running
- **index.ts** — MCP server startup hardcodes a separate DB path (`/private/tmp/mcp-guardian-server.db`) to avoid lock conflicts with proxy instances; Cline does not support `env` field in MCP config
- **macOS `/tmp` symlink** — Launch scripts now use `/private/tmp` instead of `/tmp` to avoid `proper-lockfile` ENOENT stat errors on macOS
- **`mcp-guardian proxy`** — `HistoryDatabase(dbPath)` at lines 283 and 391 now passes `process.env.MCP_GUARDIAN_DB_PATH || undefined`

### Added
- **`scripts/full-cost-report.cjs`** — Auto-detects Cline model from `~/.cline/data/globalState.json`, reads proxy databases for precise MCP tool call costs, estimates LLM conversation costs
- **`scripts/launch-proxies.sh`** — Clean startup script for multiple proxy instances with separate DB paths, health-check polling, and port cleanup
- **`scripts/cost-audit.cjs`** — CLI cost audit with per-model pricing support
- **`scripts/query-tokens.cjs`** — Quick token query from proxy databases
- **`scripts/mcp-guardian-server.sh`** — Wrapper script for mcp-guardian MCP server with env var export

## [2.1.2] - 2026-05-11

### Fixed
- oauth.ts TypeScript type error (`ReturnType` → `jose.createRemoteJWKSet`)
- Memory leaks in policy engine and proxy rate counters (LRUCache with TTL)
- README version reference (v2.0.0 → v2.1.2)
- `mcp-guardian://latest-scan` now reads real data from database
- scan-mcp.yml CI workflow references published package

### Added
- `glama.json` metadata for Glama registry
- Zod validation schemas (`src/validation/schemas.ts`)
- YAML config parsing support (`.yaml`/`.yml` files)
- Dashboard login rate limiting (5 attempts/min/IP via LRUCache)
- Dockerfile hardened: multi-stage build, non-root user, health check
- Docker build + Trivy security scan in CI
- Dynamic version from `npm_package_version`

## [2.1.0] - 2026-05-10

### Added
- Three-layer detection engine: regex triage → schema analysis → LLM semantic verdict
- Monorepo architecture (pnpm workspace, 3 packages)
- Tamper-resistant manifest (HMAC-SHA256)
- Red-team corpus with precision/recall CI gate
- HTTP/SSE transparent proxy for cost auditing
- Transitive dependency CVE scanning (npm ls --json)
- 40+ secret patterns (AWS, Azure, GCP, Stripe, Slack, Twilio, etc.)
- Per-provider token counting with `isEstimate` flag
- CVE triage (direct vs transitive classification)
- Child-process watchdog (30s timeout, auto-restart)
- Data retention (hourly purge, 30-day TTL)
- Dashboard CSP + HSTS via helmet middleware
- Scoring formula: positive bonuses, clamped 0-100
- Coverage enforcement in CI (40% threshold)
- Helm chart CI/CD workflow

### Changed
- Token counter: provider-specific counting strategies
- Secret scanner: expanded from 6 to 40+ patterns
- Scoring model: add positive bonuses and floor clamping
- Policy engine: LRUCache-backed rate counters

## [2.0.0] - 2026-05-10

### Added
- Monorepo structure: `@mcp-guardian/core`, `@mcp-guardian/cli`, `@mcp-guardian/server`
- Three-layer detection engine (regex + schema + LLM semantic)
- Tamper-resistant manifest with HMAC-SHA256
- Red-team corpus (4 poisoned + 1 benign + run-eval.ts)
- Transport layer (stdio + HTTP/SSE tool fetching)
- Corpus evaluation with nightly CI
- Provenance-signed npm publishing
- CLI package with --fail-on-critical, --json, --verbose
- Server package with scan_mcp_tools + verify_manifest

### Breaking
- Moved to pnpm workspace monorepo from single package
- Root package renamed to avoid namespace collision with server package
- CLI entry point restructured for monorepo

## [1.3.0] - 2026-05-09

### Added
- E2E proxy tests with real default-policy.yaml
- Supply chain CI pipeline (npm audit, CycloneDX SBOM, provenance)
- mTLS zero-trust networking for proxy ↔ upstream
- Operational runbooks (7 scenarios with SLOs)
- Disaster recovery plan (RTO/RPO, backup strategy, recovery drills)

### Fixed
- GitHub language detection corrected to TypeScript
- npm keywords expanded to 22 terms

## [1.2.0] - 2026-05-09

### Added
- Payload normalization layer (URL/hex/unicode/HTML entity decode)
- Semantic shell AST analysis (command substitution, pipe chains, redirects)
- Dashboard authentication (JWT sessions, API keys, CSRF protection)
- Dashboard login rate limiting

### Changed
- Policy engine: normalized payloads before regex evaluation
- Policy engine: semantic analysis integrated into evaluate() pipeline

## [1.0.0] - 2026-05-08

### Added
- Web dashboard with live Prometheus metrics and policy editor
- Redis session cache for cross-replica HA
- Redis shared rate limit counters
- DPoP (RFC 9449) sender-constrained token support
- OpenTelemetry distributed tracing (OTLP)
- HTTP/SSE proxy server for remote MCP transport
- Proxy interceptor with circuit breaker
- Benchmark suite with real proxy overhead measurements
- Helm chart for Kubernetes deployment
- 97 tests across 13 suites

### Changed
- Production-grade scoring with performance benchmarks
- Published to npm as `@mcp-guardian/server@1.0.0`

## [0.7.0] - 2026-05-08

### Added
- Redis session cache for multi-replica HA deployments
- Prometheus metrics endpoint (counters, gauges, histograms)
- E2E integration tests (real MCP server through proxy)
- Prometheus + Grafana dashboard configuration

## [0.6.0] - 2026-05-08

### Added
- Session-based replay protection (5-min session tokens)
- Nonce tracking for JWT replay detection
- Hot-reload policies (chokidar file watcher)
- PolicyAuditor for compliance audit trail
- Formal threat model documentation (THREAT_MODEL.md)

## [0.5.0] - 2026-05-08

### Added
- OAuth 2.1/OIDC JWT authentication for proxy
- OIDC Discovery (RFC 8414) with JWKS caching
- Bearer token extraction and validation
- Agent identity mapping from JWT claims

## [0.4.0] - 2026-05-08

### Added
- Active policy engine (YAML-configurable)
- Structured JSON logging (pino) for SIEM ingestion
- STRIDE threat model documentation
- Command injection validation (10 patterns)
- 74 tests across multiple suites

## [0.3.0] - 2026-05-08

### Added
- Dependency Injection container (IoC pattern)
- Token-bucket rate limiter
- TLS certificate validation
- Full JSON-RPC 2.0 state machine
- SSE/HTTP transport probing
- GitHub Actions CI (Node 18/20/22 matrix)
- 52 unit tests across 6 modules

### Changed
- Package name: `@mcp-doctor/server` → `@mcp-guardian/server`
- SQLite backend: `better-sqlite3` → `sql.js` (pure JS)
- 6 alert threshold CLI flags with exit codes

## [0.1.0] - 2026-05-07

### Added
- Initial release
- Core security scanning (CVE, auth, typo-squat, secrets)
- Cost auditing with multi-model pricing
- Health monitoring
- MCP server entry point (stdio, 4 tools)
- CLI wrapper (scan, audit, health, report)
- Config parser for Cline, Claude Desktop, Cursor, Windsurf