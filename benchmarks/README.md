# MCP Mastyff AI Performance Benchmarks

Measures per-call latency for MCP `tools/call` round-trips:

| Scenario | Description |
|----------|-------------|
| Baseline | Direct echo MCP server (no proxy) |
| Passthrough | Proxy with no policy engine |
| Blocking | Proxy with shell-injection + deny rules |

## Run locally

```bash
pnpm build
pnpm exec tsx benchmarks/run.ts
```

## CI mode

CI uses reduced iterations and a p95 gate:

```bash
BENCH_ITERATIONS=100 BENCH_WARMUP=10 BENCH_P95_THRESHOLD_MS=150 pnpm exec tsx benchmarks/run.ts
```

Writes `benchmark-report.json` at repo root. Exits non-zero if blocking-policy **p95** exceeds `BENCH_P95_THRESHOLD_MS` (default **150ms**) when `BENCH_STRICT` is not `false`. CI sets `BENCH_STRICT=false` to upload metrics without failing the job.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `BENCH_ITERATIONS` | `1000` | Measured round-trips per scenario |
| `BENCH_WARMUP` | `50` | Warmup calls (discarded) |
| `BENCH_P95_THRESHOLD_MS` | `150` | Max allowed p95 for blocking-policy scenario |
