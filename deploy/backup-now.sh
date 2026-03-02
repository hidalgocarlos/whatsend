#!/bin/bash
# ============================================================
# WhatSend — Backup completo de datos (PostgreSQL + uploads + sesiones WhatsApp)
# Ejecutar en el servidor: bash deploy/backup-now.sh
# Desde: /var/www/whatsend (o donde esté el proyecto)
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$APP_DIR/backend"
BACKUP_ROOT="${WHATSEND_BACKUP_DIR:-/var/backups/whatsend}"
RETENTION_DAYS="${WHATSEND_BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

echo "======================================"
echo " WhatSend — Backup de datos"
echo "======================================"
echo " Origen: $APP_DIR"
echo " Destino: $BACKUP_DIR"
echo ""

mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"

# ── 1. Cargar DATABASE_URL desde backend/.env ─────────────────────
if [ -f "$BACKEND_DIR/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$BACKEND_DIR/.env" 2>/dev/null || true
  set +a
fi

if [ -z "$DATABASE_URL" ]; then
  echo "[ERROR] DATABASE_URL no definido. Crea backend/.env con DATABASE_URL." >&2
  exit 1
fi

# ── 2. Backup PostgreSQL (usuarios, campañas, plantillas, listas, logs, etc.) ─
echo "[1/3] Backup base de datos PostgreSQL..."
pg_dump "$DATABASE_URL" --no-owner --no-acl -F p --clean --if-exists -f "whatsend-db-$TIMESTAMP.sql"
echo "      OK: whatsend-db-$TIMESTAMP.sql"

# ── 3. Backup archivos: uploads (plantillas, CSV) y sesiones WhatsApp ─
echo "[2/3] Backup de uploads y sesiones WhatsApp..."
TAR_FILE="whatsend-files-$TIMESTAMP.tar.gz"
TAR_ARGS=""
[ -d "$BACKEND_DIR/uploads" ] && TAR_ARGS="$TAR_ARGS uploads"
[ -d "$BACKEND_DIR/wwebjs_auth" ] && TAR_ARGS="$TAR_ARGS wwebjs_auth"
if [ -n "$TAR_ARGS" ]; then
  tar czf "$TAR_FILE" -C "$BACKEND_DIR" $TAR_ARGS
  echo "      OK: $TAR_FILE"
else
  echo "      (sin carpetas uploads/wwebjs_auth, omitido)"
fi

# ── 4. Rotación: borrar backups más antiguos que RETENTION_DAYS ─
echo "[3/3] Rotación (mantener últimos $RETENTION_DAYS días)..."
find "$BACKUP_ROOT" -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} \; 2>/dev/null || true
COUNT=$(find "$BACKUP_ROOT" -maxdepth 1 -type d | wc -l)
echo "      Carpeta de backups: $BACKUP_ROOT ($COUNT backups)"

echo ""
echo "======================================"
echo " Backup completado: $BACKUP_DIR"
echo "======================================"
