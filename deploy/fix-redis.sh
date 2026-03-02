#!/bin/bash
# ============================================================
# WhatSend — Arreglar Redis y reiniciar la app
# Ejecutar EN EL SERVIDOR: bash deploy/fix-redis.sh
# ============================================================

set -e

ENV_FILE="/var/www/whatsend/backend/.env"

echo "======================================"
echo " WhatSend — Fix Redis"
echo "======================================"
echo ""

# 1. Arrancar Redis sin contraseña (Ubuntu 22 por defecto no tiene)
echo "[1/4] Arrancando Redis..."
systemctl start redis-server
systemctl enable redis-server
sleep 2
if systemctl is-active --quiet redis-server; then
  echo "      Redis: OK (activo)"
else
  echo "      ERROR: Redis no pudo arrancar. Revisa: systemctl status redis-server"
  exit 1
fi
echo ""

# 2. Verificar que escucha en 6379
echo "[2/4] Comprobando puerto 6379..."
if ss -tlnp | grep -q 6379; then
  echo "      Puerto 6379: OK"
else
  echo "      ERROR: Redis arrancó pero no escucha en 6379."
  exit 1
fi
echo ""

# 3. Actualizar REDIS_URL en backend/.env (quitar contraseña)
echo "[3/4] Actualizando REDIS_URL en backend/.env..."
if [ -f "$ENV_FILE" ]; then
  # Reemplazar cualquier REDIS_URL por la versión sin contraseña
  sed -i 's|^REDIS_URL=.*|REDIS_URL=redis://localhost:6379|' "$ENV_FILE"
  echo "      REDIS_URL actualizada a: redis://localhost:6379"
else
  echo "      No existe $ENV_FILE. Creando entrada básica..."
  echo "REDIS_URL=redis://localhost:6379" >> "$ENV_FILE"
fi
echo ""

# 4. Reiniciar backend
echo "[4/4] Reiniciando backend (PM2)..."
cd /var/www/whatsend/backend
if pm2 list 2>/dev/null | grep -q "whatsend-api"; then
  pm2 restart whatsend-api --update-env
else
  pm2 start ecosystem.config.cjs --env production
  pm2 save
fi
sleep 3

echo ""
echo "======================================"
echo " Resultado:"
pm2 list
echo ""
echo " Últimas líneas del log:"
pm2 logs whatsend-api --lines 5 --nostream 2>/dev/null || true
echo ""
echo " Si no ves más errores ECONNREFUSED 6379, Redis está funcionando."
echo "======================================"
