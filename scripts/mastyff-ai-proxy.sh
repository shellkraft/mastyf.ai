#!/bin/sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export MASTYFF_AI_DB_PATH="${MASTYFF_AI_DB_PATH:-$HOME/.mastyff-ai/history.db}"
export DASHBOARD_ENABLED="${DASHBOARD_ENABLED:-true}"
export METRICS_ENABLED="${METRICS_ENABLED:-true}"
export METRICS_PORT="${METRICS_PORT:-9090}"
export DASHBOARD_PORT="${DASHBOARD_PORT:-4000}"
exec node "$ROOT/dist/cli.js" proxy "$@"
