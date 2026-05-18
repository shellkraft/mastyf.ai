# Enterprise AI learning

MCP Guardian learns from blocked calls and scan history. **v2.8.1+** adds per-block **instant attack learning** on proxy policy blocks, alongside the existing **batch (debounced)** `SuggestionEngine` cycle.

Deep-dive collateral: [sca/](../sca/) (reports + charts) · reproducible eval: [reports/attack-learning-eval/](../reports/attack-learning-eval/).

---

## Two learning paths

```
Policy block (tools/call denied)
        │
        ├─► INSTANT (sync, every block)
        │     • Rolling (rule, tool) counts + reason n-grams
        │     • ~/.mcp-guardian/.attack-learning-state.json
        │     • Queue attack-pattern suggestion after N repeats in window
        │
        └─► BATCH (async, debounced)
              • Full SuggestionEngine / learnAttackPatterns
              • Fires after GUARDIAN_AI_BLOCK_DEBOUNCE_MS quiet period (or 0 = immediate)
              • Same .ai-pending-suggestions.json queue
```

Human accept (TUI `a`, dashboard API) or `GUARDIAN_AI_AUTO_APPLY=true` (staging only) writes YAML. Quorum and drift gates still apply.

---

## Instant learning (v2.8.1)

On every policy block the proxy calls `recordBlockLearningEvent`:

1. **Sync** — update `~/.mcp-guardian/.attack-learning-state.json` (rule+tool counts, reason n-grams).
2. **Sliding window** — after `GUARDIAN_AI_ATTACK_MIN_BLOCKS` (default **3**) of the same `(block_rule, tool)` within `GUARDIAN_AI_INSTANT_WINDOW_MS` (default **5 min**), queue an attack-pattern suggestion to `.ai-pending-suggestions.json`.
3. **Debounced cycle** — optional full `SuggestionEngine` cycle via `GUARDIAN_AI_BLOCK_DEBOUNCE_MS` (set **`0`** for immediate).

Optional: `GUARDIAN_AI_INSTANT_LLM=true` runs a rate-limited classifier on critical blocks (`semantic-shell-guard`, `secret-scan`, `path-guard`).

Observability: `mcp_guardian_instant_learning_events_total`, structured log `instant_learning_event`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `GUARDIAN_AI_INSTANT_LEARNING` | on (with AI) | Sync per-block stats + suggestion queue |
| `GUARDIAN_AI_INSTANT_WINDOW_MS` | `300000` | Repeat-block detection window |
| `GUARDIAN_AI_INSTANT_LLM` | `false` | LLM classifier on critical blocks |
| `GUARDIAN_AI_INSTANT_LLM_RATE_MS` | `60000` | Global instant-LLM rate limit |
| `GUARDIAN_AI_ATTACK_STATE_PATH` | `~/.mcp-guardian/.attack-learning-state.json` | Instant state file |
| `GUARDIAN_AI_ATTACK_MIN_BLOCKS` | `3` | Blocks before instant attack-pattern suggestion |

---

## Batch / debounced learning

| Variable | Default | Purpose |
|----------|---------|---------|
| `GUARDIAN_AI_ENABLED` | on | Master switch for learning on proxy/report |
| `GUARDIAN_AI_AUTO_APPLY` | off | Auto-merge generated YAML rules (use quorum) |
| `GUARDIAN_AI_ON_CLI` | off | Learning on `scan`/`audit`/`health` CLI |
| `GUARDIAN_AI_SNAPSHOT_DIR` | `~/.mcp-guardian` | Persisted baselines / suggestions |
| `GUARDIAN_AI_BLOCK_DEBOUNCE_MS` | `30000` | Full learning cycle debounce (`0` = immediate) |
| `GUARDIAN_AI_DRIFT_OVERRIDE` | off | Allow threshold changes during drift |

With **2–5s** inter-arrival between blocks (typical attack stream), a **30s** debounce rarely fires mid-stream; batch pattern discovery clusters at quiet periods or session end. Instant learning discovers repeats incrementally.

---

## Safety rails (v2.6+)

- **Quorum** — multiple signals required before high-confidence suggestions (`learning-quorum.ts`).
- **Drift detection** — freezes auto threshold tuning when tool baselines drift (`drift-detector.ts`).
- **Rollback** — `mcp-guardian ai rollback` restores last known-good policy snapshot.
- **Poisoning tests** — `tests/ai/learning-poisoning.test.ts`.

---

## Evaluation methodology

Reproducible harness: `scripts/lib/attack-learning-eval-core.ts`.

| Command | Scenario | Typical use |
|---------|----------|-------------|
| `pnpm eval:attack-learning` | **Short** — ~52 min simulated session, 8–30s inter-arrival, ≥240 blocks | Fast regression, refreshes `summary.md` + `metrics.json` |
| `pnpm eval:attack-learning:long` | **Long** — 6h target, 2–5s inter-arrival, ≥2500 blocks (~4.9h simulated in latest run) | Sustained-stream / debounce penalty |
| `pnpm eval:attack-learning:charts` | Regenerates `reports/attack-learning-eval/figures/fig1–fig7.png` | After metrics refresh |

Both modes replay the **same** blocked-event stream into two simulators:

- **Instant** — per-block sync counters + windowed `suggestFromBlockedGroup`
- **Batch-only** — debounced `learnAttackPatterns` flushes only (instant path disabled)

Categories in generated events: `shell-injection`, `path-traversal`, `prompt-injection`, `sensitive-path`, `sql`, `puppeteer-url`.

**Source of truth:** [reports/attack-learning-eval/metrics.json](../reports/attack-learning-eval/metrics.json). [sca/](../sca/) security charts (`CHART_1`–`CHART_9`) come from a separate synthetic live-proxy simulator — see [sca/README.md](../sca/README.md).

### Latest long-run comparison (2026-05-18)

From `metrics.json` (`runType: "long"`, 5003 blocks, 4.87h simulated):

| Metric | Instant | Batch-only (30s debounce) |
|--------|---------|---------------------------|
| Suggestions queued | 5 | 5 |
| Unique rule×tool groups | 5 | 5 |
| Avg blocks to first suggestion | **3.0** | **1000.6** |
| Median time-to-suggestion | **41.1 s** | **4.87 h** (~17 515 s) |

Same suggestion count; instant wins on **latency** and **blocks-to-discover** under continuous attack. Narrative: [reports/attack-learning-eval/summary.md](../reports/attack-learning-eval/summary.md).

Short-run (`pnpm eval:attack-learning`) produces lower median batch latency (debounce can fire between bursts); re-run after code changes.

---

## Figure interpretation — `reports/attack-learning-eval/figures/`

| Figure | File | What to read |
|--------|------|----------------|
| **Fig 1** | `fig1-blocks-per-minute.png` | Block rate over simulated session minutes — validates sustained ~15–19 blocks/min in long run |
| **Fig 2** | `fig2-cumulative-suggestions.png` | Cumulative suggestions: instant rises in first minutes; batch flat until session-end cluster |
| **Fig 3** | `fig3-repeat-clusters.png` | Top `(rule, tool)` repeat counts in 5 min window — e.g. `semantic-shell-guard:search` |
| **Fig 5** | `fig5-queue-size.png` | Pending suggestion queue depth over time |
| **Fig 6** | `fig6-heatmap.png` | Heatmap: block rule × tool (volume by category) |
| **Fig 7** | `fig7-blocks-until-suggestion.png` | Distribution of blocks until first suggestion per group |

**Fig 4 omitted:** `fig4-cdf-time-to-suggestion.png` is excluded from docs — degenerate CDF (one point per category) renders blank. Use the median time-to-suggestion row in the metrics table above.

Interactive copy: [attack-learning-eval.canvas.tsx](../reports/attack-learning-eval/attack-learning-eval.canvas.tsx) (may reflect last **short** run — check header vs `metrics.json` `runType`).

---

## Figure interpretation — `sca/CHART_*.png`

Synthetic **180-minute live-proxy attack simulation** (12 escalating patterns). Not generated by `eval:attack-learning*`.

| Chart | File | What to read |
|-------|------|----------------|
| 1 | `CHART_1_Detection_Accuracy.png` | Stage 1 vs 2 detection by attack type |
| 2 | `CHART_2_AI_Confidence_Evolution.png` | Confidence calibration over simulation |
| 3 | `CHART_3_Detection_Latency.png` | Latency improvement Stage 1 → 2 |
| 4 | `CHART_4_Request_Blocking_Matrix.png` | Blocked vs total requests per attack |
| 5 | `CHART_5_Attack_Timeline.png` | Temporal attack progression |
| 6 | `CHART_6_Security_Metrics_Dashboard.png` | Multi-metric security dashboard |
| 7 | `CHART_7_AI_Learning_Stages.png` | Instant + batch architecture (conceptual) |
| 8 | `CHART_8_Performance_Under_Load.png` | Resource use under attack load |
| 9 | `CHART_9_Attack_Surface_Coverage.png` | Category coverage |

*CHART_10 omitted* — synthetic cost-benefit / ROI chart; not linked in docs.

Regenerate: `cd sca && python3 generate-attack-visualizations.py` (after running `live-proxy-attack-simulator.ts`).

---

## Operational recommendations

1. **Production** — Keep `GUARDIAN_AI_INSTANT_LEARNING` on; keep `GUARDIAN_AI_AUTO_APPLY=false`; review suggestions in TUI or dashboard.
2. **Continuous attack traffic** — Prefer instant path; if you rely on batch only, set `GUARDIAN_AI_BLOCK_DEBOUNCE_MS=0` or accept end-of-stream discovery delay.
3. **Tuning** — Lower `GUARDIAN_AI_ATTACK_MIN_BLOCKS` for faster suggestions (more noise); widen `GUARDIAN_AI_INSTANT_WINDOW_MS` for looser clustering.
4. **Critical blocks** — Enable `GUARDIAN_AI_INSTANT_LLM` only with API budget; respect `GUARDIAN_AI_INSTANT_LLM_RATE_MS`.
5. **Verification** — `pnpm test instant-attack-learning`; `pnpm eval:attack-learning:long` before claiming latency SLOs.
6. **Dashboard** — [sca/ai-learning-dashboard.tsx](../sca/ai-learning-dashboard.tsx) is a static prototype; wire to `metrics.json` or Prometheus for live ops.

---

## Async semantic audit (post-hoc LLM)

Non-blocking queue after sync policy passes:

| Variable | Default |
|----------|---------|
| `GUARDIAN_SEMANTIC_ASYNC` | on when LLM enabled |
| `GUARDIAN_SEMANTIC_DEBOUNCE_MS` | `500` |
| `GUARDIAN_SEMANTIC_ASYNC_MAX_QUEUE` | `200` |
| `GUARDIAN_SEMANTIC_MIN_CONFIDENCE` | `0.6` |

Observability: Prometheus `mcp_guardian_semantic_audit_*` metrics; structured log event `async_semantic_flag`.

---

## LLM response cache (enterprise)

Deduplicates identical LLM prompts across replicas (semantic scan + Ollama assistant):

| Variable | Default | Purpose |
|----------|---------|---------|
| `GUARDIAN_LLM_CACHE` | on when `REDIS_URL` set | `true` / `false` to force enable/disable |
| `GUARDIAN_LLM_CACHE_TTL_SEC` | `3600` | Redis + LRU entry TTL (seconds) |
| `REDIS_URL` | — | Shared cache backend for multi-replica HA |

Cache key: SHA-256 of `model`, `system`, `prompt`, and `temperature`. Metrics: `mcp_guardian_llm_cache_hits_total`, `mcp_guardian_llm_cache_misses_total` (label `backend`: `redis` | `lru`).

Without Redis, cache runs in-process LRU only (single replica).

---

## Centralized LLM config

| Variable | Default | Purpose |
|----------|---------|---------|
| `GUARDIAN_LLM_PROVIDER` | auto from API keys | `anthropic` \| `openai` \| `ollama` |
| `GUARDIAN_LLM_MODEL` | provider default | Model id for semantic + assistant |
| `GUARDIAN_LLM_MAX_TOKENS` | `512` | `max_tokens` / `num_predict` cap |
| `GUARDIAN_LLM_TIMEOUT_MS` | `30000` | LLM HTTP timeout |
| `GUARDIAN_LLM_TEMPERATURE` | `0.1` | Sampling temperature |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API base (`OLLAMA_URL` alias) |

Implementation: `src/config/llm-config.ts`, `src/ai/llm-cache.ts`.

---

## Operations

```bash
# Inspect learning state
mcp-guardian tui   # AI Engine tab

# Revert AI-applied rules
mcp-guardian ai rollback --policy default-policy.yaml

# Reproduce instant vs batch eval
pnpm eval:attack-learning
pnpm eval:attack-learning:long
pnpm eval:attack-learning:charts
```

Treat auto-apply as **staging-only** until you review suggestions in the TUI or dashboard API.
