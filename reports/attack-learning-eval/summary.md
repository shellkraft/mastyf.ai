# Attack learning evaluation — long-run enterprise stream

Generated: 2026-05-18T16:48:20.425Z

## Scenario

- **5003** simulated blocked `tools/call` events over **4.9h** (292 min wall-clock simulated)
- Target session: **6h** · inter-arrival: **2–5s** · min blocks: **2500**
- Categories: shell-injection, path-traversal, prompt-injection, sensitive-path, sql, puppeteer-url
- Repeat window: **5** min · min blocks to suggest: **3** · batch debounce: **30s**

## Key metrics

| Metric | Instant learning | Batch-only (debounced) |
|--------|------------------|-------------------------|
| Suggestions queued | 5 | 5 |
| Unique rule×tool groups learned | 5 | 5 |
| Avg blocks to first suggestion | 3.00 | 1000.60 |
| Median time-to-suggestion | 41.1s | 17515.7s |
| Total blocks processed | 5003 | 5003 |

## Long-run findings

1. **Instant learning outperforms batch-only on latency** — median time from first block to queued suggestion is 41.1s vs 17515.7s over 4.9h of sustained attack traffic.
2. **Suggestion throughput** — instant queued **5** attack-pattern suggestions vs **5** under batch-only debounced flushes (instant ≥ batch).
3. **Repeat clusters** — top repeat rule×tool within 5min: `semantic-shell-guard:search` (32 repeats). See `figures/fig3-repeat-clusters.png`.
4. **Continuous-stream penalty for batch-only** — with 2–5s inter-arrival, debounce (30s) rarely fires mid-stream; batch discovery clusters at session end. Instant discovers patterns incrementally (see cumulative curve in `figures/fig2-cumulative-suggestions.png`).
5. **Queue growth** — instant pending queue reaches **5** suggestions vs batch peak **5** (`figures/fig5-queue-size.png`).

## Verdict

**Instant learning outperforms batch-only** in this long-run enterprise scenario (5003 blocks, 4.9h simulated). Instant maintains sub-minute-to-few-minute discovery during active attack windows; batch-only defers evaluation until quiet periods, pushing median latency toward session end.

## Figure interpretation

All figures are generated from the same blocked-event stream (`metrics.json` → `pnpm eval:attack-learning:charts`). Long-run config: 5003 events, 2–5s inter-arrival, 5 min repeat window, min 3 blocks to suggest, 30s batch debounce.

| Fig | File | How to read it |
|-----|------|----------------|
| **1** | `fig1-blocks-per-minute.png` | **Y:** blocked `tools/call` count per simulated minute. Steady ~15–19/min shows a continuous enterprise attack stream (not a single burst). |
| **2** | `fig2-cumulative-suggestions.png` | **Instant** curve rises in the first minutes as repeat clusters hit the 3-block threshold; **batch** stays flat until debounce fires (here: end of ~4.9h stream). This is the core instant-vs-batch story. |
| **3** | `fig3-repeat-clusters.png` | Bar chart of top `(block_rule, tool)` groups with ≥3 blocks inside a 5 min window. Dominant cluster: `semantic-shell-guard:search` (32 repeats in long run). |
| **5** | `fig5-queue-size.png` | Pending attack-pattern suggestions over time. Both modes peak at **5** suggestions; instant fills the queue incrementally, batch in a late step. |
| **6** | `fig6-heatmap.png` | Intensity of blocks by **rule** (rows) × **tool** (columns). Use to see which policy rules fire on which tools under the synthetic mix. |
| **7** | `fig7-blocks-until-suggestion.png` | Histogram of how many blocks occurred before the first suggestion per discovered group. Instant clusters at **3**; batch at ~1000+ (debounce never mid-stream). |

**Fig 4 omitted:** `fig4-cdf-time-to-suggestion.png` is not linked here — the CDF is degenerate (one point per category) and renders as a blank chart. Median time-to-suggestion (**41.1s** instant vs **17 515.7s** batch) is in the key metrics table above.

**Short vs long run:** `pnpm eval:attack-learning` (~52 min, 8–30s inter-arrival) yields a lower batch median (debounce can fire between bursts). This summary reflects the **long** run in `metrics.json` (`runType: "long"`). Refresh `attack-learning-eval.canvas.tsx` after re-running evals if headline stats drift.

**Related collateral:** [sca/CHART_1–9](../../sca/) — separate 180 min live-proxy attack simulation (detection, latency, timeline, learning stages); see [sca/README.md](../../sca/README.md).

## Artifacts

- `metrics.json` — full time series, CDFs, heatmap, per-rule block counts
- `figures/` — PNG charts (300 DPI)
- `attack-learning-eval.canvas.tsx` — interactive charts
- [docs/AI_LEARNING.md](../../docs/AI_LEARNING.md) — env vars, methodology, operational guidance
