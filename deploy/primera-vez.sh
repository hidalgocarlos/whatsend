#!/bin/bash
# ============================================================
# WhatSend — Primera vez en el servidor (ejecutar EN EL SERVIDOR por SSH)
# Te pedirá la contraseña de root/sudo cuando haga falta.
# Uso: sudo bash deploy/primera-vez.sh
# ============================================================

set -e

APP_DIR="${APP_DIR:-/var/www/whatsend}"
cd "$APP_DIR"

echo "======================================"
echo " WhatSend — Primera vez (servidor)"
echo " Directorio: $APP_DIR"
echo "======================================"
echo ""

# 1. Setup: Node, PostgreSQL, Redis, Nginx, Certbot
echo "[1/5] Instalando sistema (Node, PostgreSQL, Redis, Nginx, Certbot)..."
echo "      (te pedirá contraseña si hace falta)"
bash "$APP_DIR/deploy/setup-server.sh"
echo ""

# 2. Copiar y editar .env
echo "[2/5] Configurando variables de entorno..."
if [ ! -f "$APP_DIR/backend/.env" ]; then
  cp "$APP_DIR/backend/.env.production" "$APP_DIR/backend/.env"
  echo "      Archivo backend/.env creado. Ábrelo y cambia INITIAL_ADMIN_PASSWORD (y revisa el resto)."
fi
echo "      Abriendo editor para backend/.env (guarda con Ctrl+O, Enter, sal con Ctrl+X)..."
nano "$APP_DIR/backend/.env" || true
echo ""

# 3. SSL (Certbot)
echo "[3/5] Configurando SSL (Certbot)..."
echo "      (Certbot te pedirá email para Let's Encrypt)"
cp "$APP_DIR/deploy/nginx-whatsend-step1-para-certbot.conf" /etc/nginx/sites-available/whatsend.app
ln -sf /etc/nginx/sites-available/whatsend.app /etc/nginx/sites-enabled/whatsend.app
nginx -t && systemctl reload nginx
certbot --nginx -d whatsend.app -d www.whatsend.app
cp "$APP_DIR/nginx/whatsend.app.conf" /etc/nginx/sites-available/whatsend.app
nginx -t && systemctl reload nginx
echo ""

# 4. Deploy de la app
echo "[4/5] Desplegando app (migraciones, build, PM2, cron backup)..."
bash "$APP_DIR/deploy/deploy-app.sh"
echo ""

# 5. Listo
echo "[5/5] Listo."
echo ""
echo "======================================"
echo " App: https://whatsend.app"
echo " Backup automático: diario 03:00 en /var/backups/whatsend"
echo "======================================"
