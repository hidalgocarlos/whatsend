#!/bin/bash
# WhatSend — Instalar Node.js, PostgreSQL y Redis en el servidor (Ubuntu/Debian)
# Uso: sudo bash scripts/install-server-deps.sh

set -e

echo "=== Actualizando sistema ==="
apt-get update -qq
apt-get upgrade -y -qq

echo ""
echo "=== Instalando Node.js 20 LTS ==="
if command -v node &>/dev/null && [ "$(node -v | cut -d. -f1 | tr -d 'v')" -ge 20 ]; then
  echo "Node $(node -v) ya instalado."
else
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  echo "Node $(node -v) instalado."
fi

echo ""
echo "=== Instalando PostgreSQL 16 ==="
if command -v psql &>/dev/null; then
  echo "PostgreSQL $(psql --version) ya instalado."
else
  apt-get install -y postgresql postgresql-contrib
  systemctl enable postgresql
  systemctl start postgresql
  echo "PostgreSQL instalado y en ejecución."
fi

echo ""
echo "=== Instalando Redis ==="
if command -v redis-server &>/dev/null; then
  echo "Redis $(redis-server --version) ya instalado."
else
  apt-get install -y redis-server
  systemctl enable redis-server
  systemctl start redis-server
  echo "Redis instalado y en ejecución."
fi

echo ""
echo "=== Instalando PM2 (gestor de procesos) ==="
npm install -g pm2

echo ""
echo "=== Verificación ==="
echo "Node:    $(node -v)"
echo "npm:     $(npm -v)"
echo "PostgreSQL: $(psql --version 2>/dev/null || echo 'no en PATH')"
systemctl is-active --quiet postgresql && echo "  servicio: activo" || echo "  servicio: inactivo"
echo "Redis:   $(redis-server --version 2>/dev/null || echo 'no instalado')"
systemctl is-active --quiet redis-server && echo "  servicio: activo" || echo "  servicio: inactivo"
echo "PM2:     $(pm2 -v 2>/dev/null || echo 'no instalado')"

echo ""
echo "=== Siguiente paso: crear usuario y base de datos en PostgreSQL ==="
echo "  sudo -u postgres psql"
echo "  CREATE USER whatsend WITH PASSWORD 'tu_clave_segura';"
echo "  CREATE DATABASE whatsend OWNER whatsend;"
echo "  \\q"
echo ""
echo "Listo. Node, PostgreSQL y Redis están instalados."
