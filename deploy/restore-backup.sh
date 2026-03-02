#!/bin/bash
# ============================================================
# WhatSend — Restaurar datos desde un backup
# Uso: bash deploy/restore-backup.sh [carpeta_backup]
# Ejemplo: bash deploy/restore-backup.sh /var/backups/whatsend/20260227-120000
# Si no se pasa carpeta, se lista el contenido de BACKUP_ROOT y se pide elegir.
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$APP_DIR/backend"
BACKUP_ROOT="${WHATSEND_BACKUP_DIR:-/var/backups/whatsend}"

if [ -n "$1" ]; then
  BACKUP_DIR="$1"
else
  echo "Backups disponibles en $BACKUP_ROOT:"
  ls -1t "$BACKUP_ROOT" 2>/dev/null | head -20
  echo ""
  read -r -p "Introduce la carpeta de backup a restaurar (ej: 20260227-120000): " SUBDIR
  BACKUP_DIR="$BACKUP_ROOT/$SUBDIR"
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo "[ERROR] No existe la carpeta: $BACKUP_DIR" >&2
  exit 1
fi

SQL_FILE=$(find "$BACKUP_DIR" -maxdepth 1 -name 'whatsend-db-*.sql' -type f | head -1)
TAR_FILE=$(find "$BACKUP_DIR" -maxdepth 1 -name 'whatsend-files-*.tar.gz' -type f | head -1)

if [ -z "$SQL_FILE" ]; then
  echo "[ERROR] No se encontró archivo .sql en $BACKUP_DIR" >&2
  exit 1
fi

# Cargar DATABASE_URL
if [ -f "$BACKEND_DIR/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$BACKEND_DIR/.env" 2>/dev/null || true
  set +a
fi
if [ -z "$DATABASE_URL" ]; then
  echo "[ERROR] DATABASE_URL no definido en backend/.env" >&2
  exit 1
fi

echo "======================================"
echo " WhatSend — Restaurar backup"
echo "======================================"
echo " Backup: $BACKUP_DIR"
echo " SQL:    $SQL_FILE"
echo ""
read -r -p "¿Restaurar base de datos? Se borrarán los datos actuales. (s/N): " CONFIRM
if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
  echo "Cancelado."
  exit 0
fi

echo "[1/2] Restaurando base de datos..."
psql "$DATABASE_URL" -f "$SQL_FILE"
echo "      Hecho."

if [ -n "$TAR_FILE" ]; then
  read -r -p "¿Restaurar uploads y sesiones WhatsApp? (s/N): " CONFIRM2
  if [ "$CONFIRM2" = "s" ] || [ "$CONFIRM2" = "S" ]; then
    echo "[2/2] Restaurando archivos..."
    tar xzf "$TAR_FILE" -C "$BACKEND_DIR"
    echo "      Hecho."
  fi
else
  echo "[2/2] No hay archivo tar de archivos, omitido."
fi

echo ""
echo "Restauración completada. Reinicia el backend (pm2 reload whatsend-api) si está en marcha."
