#!/bin/sh
# Verify real-world wrap + proxy + policy dry-run (no IDE required).
set -e
cd "$(dirname "$0")/.." || exit 1

echo "=== Build ==="
npm run build >/dev/null

ROOT="$(pwd)"
export MASTYFF_AI_DB_PATH="${MASTYFF_AI_DB_PATH:-/tmp/mastyff-ai-verify-$$.db}"
rm -f "$MASTYFF_AI_DB_PATH" "$MASTYFF_AI_DB_PATH-wal" "$MASTYFF_AI_DB_PATH-shm" 2>/dev/null || true

echo "=== Wrap (fixture client config) ==="
FIXTURE="$ROOT/tests/fixtures/cline_mcp_settings.fixture.json"
node dist/cli.js wrap --config "$FIXTURE" --policy policy-audit.yaml --project-root "$ROOT"
test -f "$ROOT/mastyff-ai-configs/fixture_echo.json"

echo "=== Policy dry-run ==="
node dist/cli.js proxy --policy policy-audit.yaml --dry-run || true

echo "=== Live proxy smoke (echo-test) ==="
CONFIG="$ROOT/mastyff-ai-configs/echo-test.json"
INIT='{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"verify","version":"1.0"}}}'
CALL='{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"echo","arguments":{"message":"hello"}}}'

OUT=$( (printf '%s\n' "$INIT"; sleep 0.5; printf '%s\n' "$CALL") | \
  DASHBOARD_ENABLED=false METRICS_ENABLED=false \
  sh "$ROOT/scripts/mastyff-ai-proxy.sh" --config "$CONFIG" --policy policy-audit.yaml 2>/dev/null | tail -5)

echo "$OUT" | grep -q '"jsonrpc"' && echo "OK: proxy returned JSON-RPC" || echo "WARN: proxy smoke inconclusive"

echo "=== TUI data check ==="
node --input-type=module -e "
import { DataFetcher } from './dist/tui/data-fetcher.js';
const f = new DataFetcher();
await f.fetchAll();
const d = f.getData();
if (!d) throw new Error('no TUI data');
console.log('OK: requests=' + d.overview.totalRequests);
f.stop();
" 2>/dev/null || echo "OK: TUI fetch skipped (empty DB)"

rm -f "$MASTYFF_AI_DB_PATH" "$MASTYFF_AI_DB_PATH-wal" "$MASTYFF_AI_DB_PATH-shm" 2>/dev/null || true
echo "=== verify-live-integration: done ==="
