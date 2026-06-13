#!/usr/bin/env bash
export MASTYFF_AI_DB_PATH="/private/tmp/mastyff-ai-server.db"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; exec node "$(dirname "$SCRIPT_DIR")/dist/index.js" "$@"