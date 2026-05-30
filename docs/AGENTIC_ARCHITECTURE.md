# Agentic AI Subsystem Architecture

This document describes how the 10 agentic AI features are architected within MCP Guardian.

---

## Component Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                        MCP SERVER LAYER                            │
│  src/index.ts — 35 agentic MCP tools registered + 35 handlers     │
└────────────────────────┬───────────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────────┐
│                     DI CONTAINER LAYER                             │
│  src/container.ts — All 21 agentic services instantiated at boot  │
└────────────────────────┬───────────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────────┐
│                     AGENTIC CORE FRAMEWORK                         │
│  core.ts       — AgenticResult<T>, AgenticPipeline, ApprovalGate   │
│  scheduler.ts  — Cron-based autonomous task scheduler              │
│  model-provider.ts — Unified LLM (OpenAI/Anthropic/Compatible)    │
│  task-queue.ts — Priority task queue with dedup                   │
│  telemetry.ts  — Decision audit, LLM cost tracking, metrics       │
└────────────────────────┬───────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌───────────────┐ ┌──────────────┐ ┌───────────────┐
│ FEATURE #2    │ │ FEATURE #6   │ │ FEATURE #1    │
│ Policy Gen    │ │ Prompt Inj   │ │ Threat Pred   │
│ 4 modules     │ │ 3 modules    │ │ 2 modules     │
└───────────────┘ └──────────────┘ └───────────────┘
        │                │                │
┌───────────────┐ ┌──────────────┐ ┌───────────────┐
│ FEATURE #5    │ │ FEATURE #8   │ │ FEATURE #7    │
│ Supply Chain  │ │ Drift Detect │ │ Compliance    │
│ 1 module      │ │ 1 module     │ │ 1 module      │
└───────────────┘ └──────────────┘ └───────────────┘
        │                │                │
┌───────────────┐ ┌──────────────┐ ┌───────────────┐
│ FEATURE #9    │ │ FEATURE #3   │ │ FEATURE #4    │
│ Red Team      │ │ Threat Mesh  │ │ Honeypot      │
│ 1 module      │ │ 1 module     │ │ 1 module      │
└───────────────┘ └──────────────┘ └───────────────┘
                         │
                ┌────────▼────────┐
                │ FEATURE #10     │
                │ Trust Protocol  │
                │ 1 module        │
                └─────────────────┘

                         │
┌────────────────────────▼───────────────────────────────────────────┐
│                    INTEGRATION LAYER                               │
│  proxy-integration.ts — Hooks for proxy pipeline                   │
│  dashboard/agentic-routes.ts — REST API for dashboard              │
│  database/migrations/011-agentic-tables.sql — 14 tables + 7 idx   │
└────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Policy Generation (Feature #2)

```
AI Agent tools/call
        │
        ▼
[Proxy Pipeline]
        │  hookAgenticObservation()
        ▼
BehaviorCollector.record()
        │  collects tool names, arg schemas, co-occurrences
        ▼
ObservationWindow (in-memory, 50-window history)
        │  finalizeWindow()
        ▼
PatternAnalyzer.analyze()
        │  produces ToolProfiles, workflows
        ▼
PolicySynthesizer.synthesize()
        │  generates YAML with allow/deny/rate-limit/semantic-guard
        ▼
Generated policy + suggestions
```

---

## Data Flow: Prompt Injection Detection (Feature #6)

```
AI Agent tools/call args
        │
        ▼
PromptInjectionDetector.scan()
        │
        ├── Stage 1: Heuristic (PROMPT_INJECTION_PATTERNS)
        │   50+ regexes across 8 categories, < 5ms
        │
        └── Stage 2: Semantic (LLM, if configured)
              OpenAI/Anthropic/Compatible, ~200-500ms
        │
        ▼
Combined confidence score
        │
        ├── confidence > 0.7 → BLOCK + sanitize args
        ├── confidence > 0.5 → WARN + sanitize args
        └── confidence ≤ 0.5 → PASS
```

---

## Design Principles

### 1. **Graceful Degradation with LLM**
All features have heuristic/regex fallbacks. LLM is optional and enhances accuracy but is never required for basic operation.

### 2. **Privacy by Design (Threat Mesh)**
- Attack signatures are hashed before leaving the deployment
- Differential privacy (ε-configurable) suppresses low-frequency observations
- Minimum report threshold (default: 3) prevents data leakage
- Raw tool call data never leaves the deployment

### 3. **Human-in-the-Loop**
- `ApprovalGate` provides explicit approval/deny workflow
- High-confidence decisions auto-apply
- Medium-confidence decisions require human review
- Full audit trail via `AgenticDecision` records

### 4. **Least Privilege (Policy Generator)**
Generated policies only allow tools that were actually observed being used, with argument types/ranges that match observed patterns. Rate limits are set at peak + 50% buffer.

### 5. **Ephemeral by Default (Honeypots, Trust Sessions)**
- Honeypots auto-destroy after configurable TTL
- Trust sessions auto-expire after negotiated duration
- No persistent state for temporary security constructs

---

## Module Responsibility Matrix

| Module | Responsibility | Dependencies |
|--------|---------------|--------------|
| `core.ts` | Result types, pipeline orchestration, approval gates | Logger |
| `scheduler.ts` | Autonomous task scheduling | Logger |
| `model-provider.ts` | LLM API abstraction (OpenAI, Anthropic, Compatible) | Logger |
| `task-queue.ts` | Priority queue with dedup and concurrency | Logger |
| `telemetry.ts` | Decision audit trail, metrics, LLM cost | Logger |
| `behavior-collector.ts` | Tool call observation and windowing | Logger |
| `pattern-analyzer.ts` | Behavioral analysis and profiling | behavior-collector |
| `policy-synthesizer.ts` | YAML policy generation | pattern-analyzer |
| `policy-diff.ts` | Policy comparison and recommendation | policy-synthesizer |
| `detector.ts` | Two-stage prompt injection detection | model-provider, payload-patterns |
| `payload-patterns.ts` | Curated regex patterns (8 categories) | None |
| `argument-sanitizer.ts` | Neutralizing injection payloads | detector |
| `risk-scorer.ts` | 5-factor server risk scoring | None |
| `predictor.ts` | Threat forecasting (30/90/365 days) | risk-scorer |
| `signature-verifier.ts` | Supply chain integrity verification | None |
| `drift-detector.ts` | Behavioral drift detection and rollback | None |
| `control-mapper.ts` | Compliance framework mapping | None |
| `attack-generator.ts` | Attack mutation and combination engine | None |
| `mesh-node.ts` | Privacy-preserving threat intel sharing | None |
| `honeypot-manager.ts` | Decoy server deployment and capture | None |
| `protocol.ts` | Agent-to-agent trust negotiation | None |
| `proxy-integration.ts` | Proxy pipeline hooks | Container |

---

## Performance Characteristics

| Feature | Heuristic Mode | LLM Mode | Memory |
|---------|---------------|----------|--------|
| Policy Generation | O(n·t) for n calls, t tools | N/A | ~KB per observation window |
| Prompt Injection | < 5ms per scan | +200-500ms per scan | < 100KB |
| Threat Prediction | < 1ms per server | N/A | < 1KB per server |
| Supply Chain | < 5ms per package | N/A | < 10KB |
| Drift Detection | < 10ms per comparison | N/A | ~1KB per baseline |
| Compliance | < 5ms per framework | N/A | ~5KB per framework |
| Red Team | < 100ms for 50 attacks | N/A | ~50KB |
| Threat Mesh | < 1ms per observation | N/A | ~1KB per signature |
| Honeypot | < 1ms per deploy | N/A | ~5KB per honeypot |
| Trust Protocol | < 5ms per negotiation | N/A | ~2KB per session |