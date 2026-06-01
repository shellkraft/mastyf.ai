#!/usr/bin/env sh
# One-shot developer setup (git clone). Prefer: mcp-guardian setup
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ -f dist/cli.js ]; then
  exec node dist/cli.js setup "$@"
fi
echo "[setup] Building CLI first…" >&2
pnpm install
pnpm run build
exec node dist/cli.js setup "$@"
