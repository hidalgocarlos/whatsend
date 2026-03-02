#!/bin/bash
# ============================================================
# WhatSend — Script de instalación inicial en Hetzner
# Probado en: Ubuntu 22.04 LTS y 24.04 LTS
# Ejecutar como root: bash setup-server.sh
# ============================================================

set -e

echo "======================================"
echo " WhatSend — Setup Servidor Hetzner"
echo "======================================"

# ── 1. Actualizar sistema ─────────────────────────────────
apt-get update -y && apt-get upgrade -y

# ── 2. Instalar utilidades base (incluyendo unzip para uploads) ──
apt-get install -y curl unzip

# ── 3. Instalar Node.js 22 LTS ───────────────────────────
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# ── 4. Instalar PM2 globalmente ──────────────────────────
npm install -g pm2

# ── 5. Instalar PostgreSQL 16 ────────────────────────────
apt-get install -y postgresql postgresql-contrib

# Crear usuario y base de datos (idempotente: no falla si ya existen)
sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'whatsend') THEN
    CREATE USER whatsend WITH PASSWORD 'WXkx6ExNPmrHn__4pymQTi8K_Uyy8fUX';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE whatsend OWNER whatsend'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'whatsend') \gexec

GRANT ALL PRIVILEGES ON DATABASE whatsend TO whatsend;
SQL

# ── 6. Instalar Redis 7 ──────────────────────────────────
apt-get install -y redis-server

# Configurar contraseña en Redis
sed -i 's/^# requirepass .*/requirepass 436-IjyeFwr2mMF1JQ-YISeplUt_rmaT/' /etc/redis/redis.conf
# Deshabilitar acceso externo (solo localhost)
sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf
systemctl restart redis-server
systemctl enable redis-server

# ── 7. Instalar Nginx ────────────────────────────────────
apt-get install -y nginx

# ── 8. Instalar Certbot para SSL ─────────────────────────
apt-get install -y certbot python3-certbot-nginx

# ── 9. Crear directorios de la app y de backups ──────────
mkdir -p /var/www/whatsend
mkdir -p /var/www/whatsend/backend
mkdir -p /var/www/whatsend/frontend
mkdir -p /var/backups/whatsend
mkdir -p /var/log/whatsend

echo ""
echo "======================================"
echo " Instalación base completada."
echo " Próximos pasos:"
echo "  1. Subir código al servidor"
echo "  2. Copiar backend/.env.production → backend/.env"
echo "  3. Ejecutar: bash /var/www/whatsend/deploy/deploy-app.sh"
echo "  4. Configurar SSL: certbot --nginx -d whatsend.app -d www.whatsend.app"
echo "  5. El cron de backup se instala automáticamente en el paso 3"
echo "======================================"
