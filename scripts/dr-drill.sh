#!/usr/bin/env bash
# Quarterly DR drill — restore backup to temp DB and verify row count.
set -euo pipefail

BACKUP_FILE="${1:-}"
TEMP_DB="${DR_DRILL_DATABASE_URL:-postgresql://mastyf-ai:mastyf-ai@localhost:5432/mastyf_ai_drill}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: DR_DRILL_DATABASE_URL=... $0 /path/to/backup.dump"
  exit 1
fi

echo "[dr-drill] Restoring $BACKUP_FILE to temp database"
if [[ "$BACKUP_FILE" == *.db ]]; then
  cp "$BACKUP_FILE" /tmp/dr-drill-history.db
  echo "[dr-drill] SQLite copy OK ($(stat -f%z /tmp/dr-drill-history.db 2>/dev/null || stat -c%s /tmp/dr-drill-history.db) bytes)"
else
  pg_restore -d "$TEMP_DB" --clean --if-exists "$BACKUP_FILE"
  COUNT=$(psql "$TEMP_DB" -tAc "SELECT COUNT(*) FROM call_records" 2>/dev/null || echo 0)
  echo "[dr-drill] Postgres call_records count: $COUNT"
  if [[ "$COUNT" -lt 1 ]]; then
    echo "[dr-drill] WARN: zero rows — verify backup freshness"
    exit 1
  fi
fi

echo "[dr-drill] OK"
