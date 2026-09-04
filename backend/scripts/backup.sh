#!/bin/bash
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set. Refusing to run backup without an explicit database target." >&2
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"
RETENTION_DAYS=14
BACKUP_FILE="$BACKUP_DIR/edem_$TIMESTAMP.dump"

mkdir -p "$BACKUP_DIR"

pg_dump "$DATABASE_URL" -F c -f "$BACKUP_FILE"

if [ ! -s "$BACKUP_FILE" ]; then
  echo "ERROR: Backup verification failed: $BACKUP_FILE is missing or empty. Skipping prune." >&2
  exit 1
fi

if command -v pg_restore >/dev/null 2>&1; then
  if ! pg_restore --list "$BACKUP_FILE" >/dev/null; then
    echo "ERROR: Backup verification failed: $BACKUP_FILE is not a valid dump. Skipping prune." >&2
    exit 1
  fi
fi

echo "Backup verified: edem_$TIMESTAMP.dump"

find "$BACKUP_DIR" -name "*.dump" -mtime +"$RETENTION_DAYS" -delete

echo "Backup created: edem_$TIMESTAMP.dump"
