# WhatSend

Aplicación web multiusuario para envío masivo de mensajes WhatsApp (hasta 80 por campaña en 24H). Cada usuario conecta su propio número vía QR. Dashboard con estadísticas en tiempo real e históricas.

## Requisitos

- Node.js 20+
- Docker y Docker Compose (para PostgreSQL y Redis en desarrollo)

## Desarrollo rápido

### 1. Levantar base de datos y Redis

```bash
docker-compose up -d
```

PostgreSQL queda en **puerto 15432** y Redis en **16379** (por compatibilidad en Windows).

### 2. Backend

Ejecuta **cada línea por separado** en la terminal (en PowerShell no uses `&&`).

```bash
cd backend
copy .env.example .env
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

(O en PowerShell todo en una línea: `cd backend; copy .env.example .env; npm install; npx prisma migrate dev --name init; npx prisma db seed; npm run dev`)

### 3. Frontend

Abre **otra terminal** y ejecuta cada línea por separado:

```bash
cd frontend
npm install
npm run dev
```

(PowerShell una línea: `cd frontend; npm install; npm run dev`)

- **API**: http://localhost:3001  
- **App**: http://localhost:5173  
- **Login**: `admin@whatsend.local` / `ChangeMe123!`

## Producción

Crear `.env` en la raíz con: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `POSTGRES_PASSWORD`, `FRONTEND_URL`.

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

La app queda en el puerto 80. Los datos persisten en volumes: `postgres_data`, `redis_data`, `wwebjs_auth`, `uploads_data`, `backups_data`. Actualizar no borra datos. En PowerShell: `docker-compose -f docker-compose.prod.yml pull; docker-compose -f docker-compose.prod.yml up -d`
