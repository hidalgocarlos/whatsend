#!/bin/bash
# ============================================================
# WhatSend — Deploy / actualización de la app
# Ejecutar desde /var/www/whatsend después de subir el código
# ============================================================

set -e

APP_DIR="/var/www/whatsend"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

echo "======================================"
echo " WhatSend — Deploy whatsend.app"
echo "======================================"

# ── Backend ──────────────────────────────────────────────
echo "[1/7] Instalando dependencias del backend..."
cd "$BACKEND_DIR"
npm ci

echo "[2/7] Ejecutando migraciones de base de datos..."
npx prisma migrate deploy
npx prisma generate

echo "[3/7] Ejecutando seed (solo si la DB está vacía)..."
npx prisma db seed || echo "Seed omitido (ya existen datos)"

# ── Frontend ─────────────────────────────────────────────
echo "[4/7] Compilando frontend..."
cd "$FRONTEND_DIR"
# npm ci instala todas las dependencias (incluyendo devDependencies necesarias para el build)
npm ci
npm run build

# ── Nginx ────────────────────────────────────────────────
echo "[5/7] Actualizando configuración de Nginx..."
cp "$APP_DIR/nginx/whatsend.app.conf" /etc/nginx/sites-available/whatsend.app
ln -sf /etc/nginx/sites-available/whatsend.app /etc/nginx/sites-enabled/whatsend.app
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── PM2 ──────────────────────────────────────────────────
echo "[6/7] Reiniciando backend con PM2..."
mkdir -p /var/log/whatsend
cd "$BACKEND_DIR"

if pm2 list | grep -q "whatsend-api"; then
  pm2 reload whatsend-api --update-env
else
  pm2 start ecosystem.config.cjs --env production
  pm2 save
  # Configurar arranque automático al reiniciar el servidor
  PM2_STARTUP=$(pm2 startup | tail -n 1)
  if echo "$PM2_STARTUP" | grep -q "sudo"; then
    eval "$PM2_STARTUP"
  fi
fi

# ── Cron backup automático (diario 3:00) ───────────────────
echo "[7/7] Configurando cron de backup automático..."
BACKUP_CRON="/etc/cron.d/whatsend-backup"
BACKUP_LINE="0 3 * * * root WHATSEND_BACKUP_DIR=/var/backups/whatsend $APP_DIR/deploy/backup-now.sh >> /var/log/whatsend-backup.log 2>&1"
if [ -w /etc/cron.d ]; then
  echo "SHELL=/bin/bash" > "$BACKUP_CRON"
  echo "PATH=/usr/local/bin:/usr/bin:/bin" >> "$BACKUP_CRON"
  echo "$BACKUP_LINE" >> "$BACKUP_CRON"
  echo "      OK: backup diario a las 03:00 en /var/backups/whatsend"
else
  echo "      AVISO: ejecuta como root para instalar cron automático"
  echo "      O añade manualmente a crontab -e:"
  echo "      0 3 * * * $APP_DIR/deploy/backup-now.sh >> /var/log/whatsend-backup.log 2>&1"
fi

echo ""
echo "======================================"
echo " Deploy completado."
echo " App corriendo en https://whatsend.app"
echo " Backup automático: diario 03:00 en /var/backups/whatsend"
echo " Logs: pm2 logs whatsend-api"
echo "======================================"
