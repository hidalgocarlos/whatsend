#!/bin/bash
# Ejecutar diariamente via cron (ej: 0 2 * * * /path/to/backup.sh)
# Requiere que BACKUPS_DIR y POSTGRES_* estén definidos o usar docker exec

set -e
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUPS_DIR="${BACKUPS_DIR:-./backups}"
mkdir -p "$BACKUPS_DIR"

if [ -n "$DOCKER_CONTAINER" ]; then
  docker exec "$DOCKER_CONTAINER" pg_dump -U postgres whatsend | gzip > "$BACKUPS_DIR/whatsend_${TIMESTAMP}.sql.gz"
else
  PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}" PGPASSWORD="${PGPASSWORD:-postgres}" pg_dump whatsend | gzip > "$BACKUPS_DIR/whatsend_${TIMESTAMP}.sql.gz"
fi

find "$BACKUPS_DIR" -name "*.sql.gz" -mtime +30 -delete
echo "Backup: whatsend_${TIMESTAMP}.sql.gz"
