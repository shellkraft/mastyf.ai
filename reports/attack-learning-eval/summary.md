# Attack learning evaluation — enterprise stream scenario

Generated: 2026-05-18T16:27:13.069Z

## Scenario

- **305** simulated blocked `tools/call` events over **52** minutes
- Categories: shell-injection, path-traversal, prompt-injection, sensitive-path, sql, puppeteer-url
- Repeat window: **5** min · min blocks to suggest: **3** · batch debounce: **30s**

## Key metrics

| Metric | Instant learning | Batch-only (debounced) |
|--------|------------------|-------------------------|
| Suggestions queued | 5 | 5 |
| Unique rule×tool groups learned | 5 | 5 |
| Avg blocks to first suggestion | 3.00 | 61.00 |
| Median time-to-suggestion | 242.4s | 3000.1s |
| Total blocks processed | 305 | 305 |

## Findings

1. **Instant learning outperforms batch-only on latency** — median time from first block to queued suggestion is 242.4s vs 3000.1s.
2. **Suggestion throughput** — instant queued **5** attack-pattern suggestions vs **5** under batch-only debounced `learnAttackPatterns` flushes.
3. **Repeat clusters** — top repeat rule×tool within 5min: `semantic-shell-guard:search` (45 repeats).
4. **Per-block sync path** — instant learning updates rolling state on every block; batch-only waits for **30s** quiet period before evaluating patterns.

## Verdict

**Instant learning outperforms batch-only** in this enterprise burst scenario. Instant reduces time-to-suggestion by synchronously counting window blocks and queueing after `3` hits; batch-only defers pattern extraction until debounce boundaries, which delays discovery during continuous attack streams.

## Artifacts

- `metrics.json` — full time series and per-category latencies
- `attack-learning-eval.canvas.tsx` — interactive charts (open from Cursor canvases or reports copy)
