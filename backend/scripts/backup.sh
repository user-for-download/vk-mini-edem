#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

pg_dump -U edem -d edem -F c -f "$BACKUP_DIR/edem_$TIMESTAMP.dump"

find "$BACKUP_DIR" -name "*.dump" -mtime +$RETENTION_DAYS -delete

echo "Backup created: edem_$TIMESTAMP.dump"
