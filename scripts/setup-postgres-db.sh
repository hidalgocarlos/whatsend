#!/bin/bash
# Crear usuario y base de datos WhatSend en PostgreSQL
# Uso: WHATSEND_DB_PASSWORD='tu_clave_segura' sudo bash scripts/setup-postgres-db.sh
# Si el usuario o la BD ya existen, verás un error que puedes ignorar.

set -e

DB_USER="${WHATSEND_DB_USER:-whatsend}"
DB_NAME="${WHATSEND_DB_NAME:-whatsend}"
DB_PASS="${WHATSEND_DB_PASSWORD:-}"

if [ -z "$DB_PASS" ]; then
  echo "Define la contraseña: WHATSEND_DB_PASSWORD='tu_clave' sudo bash scripts/setup-postgres-db.sh"
  exit 1
fi

sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || true

echo "Listo. DATABASE_URL para backend/.env:"
echo "DATABASE_URL=\"postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public\""
