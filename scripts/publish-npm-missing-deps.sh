#!/usr/bin/env bash
# Publish @mastyff-ai/plugin-sdk and @mastyff-ai/core for the current monorepo version
# when server was published without its dependency chain (install fails with ETARGET).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/scripts/publish-npm-all.sh"
