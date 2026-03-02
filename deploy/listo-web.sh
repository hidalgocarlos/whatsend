#!/bin/bash
# ============================================================
# WhatSend — Dejar la web funcionando en el servidor
# Ejecutar EN EL SERVIDOR como root: bash deploy/listo-web.sh
# Requiere: código en /var/www/whatsend (git clone)
# Opcional: si faltan PostgreSQL/Redis/Nginx, los instala y configura.
# ============================================================

set -e

APP_DIR="${APP_DIR:-/var/www/whatsend}"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
DEPLOY_DIR="$APP_DIR/deploy"

cd "$APP_DIR"

echo "======================================"
echo " WhatSend — Dejar web funcionando"
echo " Directorio: $APP_DIR"
echo "======================================"
echo ""

# ── 0. Instalar PostgreSQL, Redis, Nginx si faltan ───────
echo "[0] Comprobando PostgreSQL, Redis, Nginx..."
if ! command -v psql &>/dev/null; then
  apt-get update -qq && apt-get install -y postgresql postgresql-contrib
  systemctl enable postgresql
  systemctl start postgresql
fi
if ! command -v redis-server &>/dev/null; then
  apt-get install -y redis-server
  systemctl enable redis-server
  systemctl start redis-server
fi
if ! command -v nginx &>/dev/null; then
  apt-get install -y nginx
fi
if ! command -v certbot &>/dev/null; then
  apt-get install -y certbot python3-certbot-nginx
fi

# Crear usuario y BD en PostgreSQL (ignorar error si ya existen)
sudo -u postgres psql -c "CREATE USER whatsend WITH PASSWORD 'WXkx6ExNPmrHn__4pymQTi8K_Uyy8fUX';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE whatsend OWNER whatsend;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE whatsend TO whatsend;" 2>/dev/null || true

# Redis: contraseña (idempotente)
if ! grep -q '^requirepass 436-IjyeFwr2mMF1JQ-YISeplUt_rmaT' /etc/redis/redis.conf 2>/dev/null; then
  sed -i 's/^# requirepass .*/requirepass 436-IjyeFwr2mMF1JQ-YISeplUt_rmaT/' /etc/redis/redis.conf 2>/dev/null || true
  sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf 2>/dev/null || true
  systemctl restart redis-server 2>/dev/null || true
fi

echo ""

# ── 1. Backend .env ───────────────────────────────────────
echo "[1/6] Configurando backend/.env..."
if [ ! -f "$BACKEND_DIR/.env" ]; then
  cp "$DEPLOY_DIR/env.production.template" "$BACKEND_DIR/.env"
  echo "      Creado desde deploy/env.production.template. Edita backend/.env si cambiaste claves de BD/Redis."
else
  echo "      Ya existe backend/.env, no se sobrescribe."
fi
echo ""

# ── 2. Backend: dependencias, migraciones, seed ───────────
echo "[2/6] Backend: npm ci, migraciones, seed..."
cd "$BACKEND_DIR"
npm ci
npx prisma generate
npx prisma migrate deploy
npx prisma db seed 2>/dev/null || echo "      Seed omitido (ya hay datos o error)."
echo ""

# ── 3. Frontend: build ────────────────────────────────────
echo "[3/6] Frontend: npm ci, build..."
cd "$FRONTEND_DIR"
npm ci
npm run build
echo ""

# ── 4. Nginx: config HTTP (puerto 80) ────────────────────
echo "[4/6] Nginx: config temporal HTTP (puerto 80)..."
cp "$DEPLOY_DIR/nginx-whatsend-step1-para-certbot.conf" /etc/nginx/sites-available/whatsend.app
ln -sf /etc/nginx/sites-available/whatsend.app /etc/nginx/sites-enabled/whatsend.app
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo ""

# ── 5. PM2: backend ───────────────────────────────────────
echo "[5/6] PM2: reiniciando backend..."
mkdir -p /var/log/whatsend
cd "$BACKEND_DIR"
if pm2 list 2>/dev/null | grep -q "whatsend-api"; then
  pm2 reload whatsend-api --update-env
else
  pm2 start ecosystem.config.cjs --env production
  pm2 save
  pm2 startup systemd -u root --hp /root 2>/dev/null || true
fi
echo ""

# ── 6. SSL (Certbot) y Nginx final ─────────────────────────
echo "[6/6] SSL y Nginx final..."
if command -v certbot &>/dev/null && [ ! -d /etc/letsencrypt/live/whatsend.app ]; then
  echo "      Obteniendo certificado SSL (Certbot)..."
  CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@whatsend.app}"
  certbot --nginx -d whatsend.app -d www.whatsend.app --non-interactive --agree-tos --email "$CERTBOT_EMAIL" --redirect || echo "      Certbot falló (revisa DNS). La web sigue en HTTP."
fi
if [ -d /etc/letsencrypt/live/whatsend.app ]; then
  cp "$APP_DIR/nginx/whatsend.app.conf" /etc/nginx/sites-available/whatsend.app
  nginx -t && systemctl reload nginx
  echo "      Nginx con SSL activado."
else
  echo "      Sin certificado SSL. Usa: certbot --nginx -d whatsend.app -d www.whatsend.app"
  echo "      Luego: cp $APP_DIR/nginx/whatsend.app.conf /etc/nginx/sites-available/whatsend.app && nginx -t && systemctl reload nginx"
fi

echo ""
echo "======================================"
echo " Listo."
echo "  Web:  http://whatsend.app  (o https si Certbot funcionó)"
echo "  API:  puerto 3001 (detrás de Nginx)"
echo "  Logs: pm2 logs whatsend-api"
echo "======================================"
