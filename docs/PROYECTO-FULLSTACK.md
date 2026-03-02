# WhatSend — Resumen técnico del proyecto (vista senior)

Documento de referencia para incorporación de desarrolladores. Descripción del stack, arquitectura, bases de datos, seguridad y despliegue.

---

## 1. Qué es el producto

**WhatSend** es una aplicación web para **envío masivo de mensajes por WhatsApp**. Permite a varios usuarios (roles Admin / Operador) conectar una sesión de WhatsApp, crear plantillas con variables, cargar listas de contactos (CSV) y lanzar campañas de envío. Incluye límite de uso (mensajes/24h), historial, logs de envío y auditoría.

- **Dominio producción:** https://whatsend.app  
- **Stack:** Full stack JavaScript (Node.js + React), PostgreSQL, Redis, colas con BullMQ, integración vía whatsapp-web.js (Puppeteer/Chromium).

---

## 2. Stack técnico

| Capa | Tecnología | Versión / notas |
|------|------------|------------------|
| **Frontend** | React | 18.x |
| **Build / dev** | Vite | 5.x |
| **Estilos** | Tailwind CSS | 3.x, tipografía Inter (Google Fonts) |
| **Estado global** | Zustand | authStore (usuario, logout) |
| **HTTP cliente** | Axios | withCredentials para cookies, interceptors para refresh JWT |
| **Routing** | React Router | v6 |
| **Gráficos** | Recharts | Dashboard (envíos, etc.) |
| **Backend** | Node.js | >= 20, ESM (`"type": "module"`) |
| **Framework API** | Express | 4.x |
| **ORM** | Prisma | 5.x, migraciones en `backend/src/prisma/` |
| **Base de datos** | PostgreSQL | 14/16 según entorno |
| **Cache / sesiones** | Redis | JWT blacklist, BullMQ, uso 24h en memoria/Redis |
| **Colas** | BullMQ | Envío de mensajes de campañas (workers) |
| **WhatsApp** | whatsapp-web.js | 1.23, Puppeteer/Chromium, sesión por usuario en `wwebjs_auth` |
| **Procesamiento CSV** | csv-parse | Listas de contactos |
| **Subida archivos** | Multer | Plantillas (imagen/audio), CSV listas |
| **Producción** | Nginx, PM2, Let's Encrypt | Ubuntu 22/24, Hetzner |

---

## 3. Lenguajes y convenciones

- **Frontend:** JavaScript (JSX), React (hooks), componentes funcionales.
- **Backend:** JavaScript (ESM), async/await, estructura por capas: `routes` → `controllers` → `services` → `lib` / Prisma.
- **Base de datos:** SQL vía Prisma (schema en `backend/src/prisma/schema.prisma`), migraciones versionadas.
- **Estilo:** Comentarios y mensajes de API en español; variables y nombres técnicos en inglés.

---

## 4. Bases de datos y persistencia

### PostgreSQL (datos de negocio)

- **Conexión:** `DATABASE_URL` en env. Prisma Client generado con `prisma generate`.
- **Modelos principales:**  
  `User`, `Template`, `ContactList`, `ContactListItem`, `Campaign`, `CampaignRecipient`, `SendLog`, `AuditLog`, `AppConfig`.
- **Relaciones:** Usuario → plantillas, listas, campañas; campaña → plantilla, lista, destinatarios, sendLogs. Borrados en cascada donde aplica.
- **Migraciones:** `npx prisma migrate deploy` en deploy; solo migraciones aditivas (no se borran datos al actualizar código).
- **Seed:** `prisma db seed` crea un usuario admin inicial si no existe (email y contraseña desde env).

### Redis

- **Uso:** URL en `REDIS_URL` (producción con contraseña).
- **Funciones:** Blacklist de refresh tokens (revocación JWT), cola BullMQ para jobs de envío, y opcionalmente contador de uso 24h.
- **Cliente:** `ioredis` en `backend/src/lib/redis.js`.

### Archivos en disco (servidor)

- **uploads/** — Medios de plantillas (imagen/audio) y CSV de listas; no van en Git.
- **wwebjs_auth/** — Sesiones de WhatsApp por usuario; no van en Git.
- **Backups:** Script `deploy/backup-now.sh` (pg_dump + tar de uploads y wwebjs_auth); cron diario configurado en deploy.

---

## 5. Seguridad

### Autenticación y sesión

- **Login:** Email + contraseña; validación de formato de email y longitud de contraseña (máx. 256).
- **Contraseñas:** bcrypt (cost 12); mismo mensaje genérico en login para no revelar si el email existe.
- **JWT:** Access token (15 min) en memoria en el frontend (no en localStorage); refresh token (7 días) en cookie `httpOnly`, `secure` en producción, `sameSite: strict`, `path: /api/auth`.
- **Refresh:** Rotación de refresh token; el anterior se revoca en Redis antes de emitir uno nuevo.
- **Cambio de contraseña:** Requiere contraseña actual; nueva con mínimo 8 y máximo 256 caracteres; tras cambio se revoca sesión y se fuerza re-login.

### Protección de la API

- **Rate limiting:** Login (10/15 min), refresh (30/5 min), cambio de contraseña (5/hora).
- **CORS:** Origen restringido a `FRONTEND_URL` (producción: https://whatsend.app).
- **Helmet:** Headers de seguridad; `crossOriginResourcePolicy: cross-origin` para recursos.
- **Proxy:** `trust proxy` en producción (Nginx delante).
- **Rutas protegidas:** Middleware `authMiddleware` (Bearer) y `role` (ADMIN/OPERATOR); SSE con `sseAuth` (token en query/header).

### Auditoría

- **AuditLog:** Acciones LOGIN, LOGOUT, CHANGE_PASSWORD y otras relevantes; registro con userId, IP, userAgent, etc.

### Despliegue

- **Secrets:** JWT, DB y Redis solo en variables de entorno en servidor; `.env` y `.env.production` en `.gitignore`.
- **HTTPS:** Nginx + Let's Encrypt; redirección HTTP→HTTPS y www→apex.

Documentación detallada: `docs/SECURITY-LOGIN.md`.

---

## 6. Arquitectura de la aplicación

### Backend (Express)

- **Entrada:** `backend/src/index.js` — Carga env, Helmet, CORS, rate limiters, rutas, `/api/health`, manejo de errores.
- **Rutas:** `/api/auth`, `/api/whatsapp`, `/api/users`, `/api/templates`, `/api/lists`, `/api/campaigns`, `/api/dashboard`, `/api/logs`.
- **Flujo típico:** `routes/*.js` → `authMiddleware` / `role` → `controllers/*.js` → `services/*.js` y Prisma.
- **Cola:** `queue.service.js` define jobs de envío; worker BullMQ procesa campañas y actualiza estado; progreso opcional vía SSE.
- **WhatsApp:** `whatsappPool.service.js` — una instancia de cliente whatsapp-web.js por usuario; reconexión al arrancar según sesiones en `wwebjs_auth`.

### Frontend (React + Vite)

- **Entrada:** `main.jsx` → `App.jsx`; rutas en `App.jsx` (login, dashboard, campañas, plantillas, listas, WhatsApp, historial, logs, usuarios, auditoría).
- **Layout:** `Layout.jsx` — sidebar, hora, uso 24h, estado WhatsApp, navegación; rutas privadas envueltas en layout.
- **API:** `services/api.js` — Axios con `baseURL` desde `VITE_API_URL` (vacío en producción = misma origen); token en memoria; interceptor de 401 con refresh y reintento; `withCredentials: true`.
- **SSE:** Hook o lógica para QR y progreso de campaña usando `getAccessToken()` (no localStorage).

### Despliegue (Hetzner)

- **Servidor:** Ubuntu 22.04/24.04; Node 22, PM2, PostgreSQL, Redis, Nginx, Certbot; dependencias para Chromium (Puppeteer).
- **App:** Código en `/var/www/whatsend`; backend con `node src/index.js` vía PM2; frontend servido como estático desde `frontend/dist` por Nginx.
- **Nginx:** Proxy `/api/` al backend (puerto 3001), SSL, HSTS, timeouts largos para SSE.
- **Scripts:** `deploy/setup-server.sh` (primera vez), `deploy/deploy-app.sh` (deploy y cron de backup), `deploy/backup-now.sh` y `deploy/restore-backup.sh`; documentación en `deploy/README-DEPLOY.md` y `docs/BACKUP-DATOS.md`.

---

## 7. Estructura de carpetas relevante

```
whatsend/
├── backend/
│   ├── src/
│   │   ├── index.js              # Entrada API
│   │   ├── controllers/          # Lógica por recurso
│   │   ├── routes/               # Rutas Express
│   │   ├── services/             # Negocio, cola, WhatsApp, uso, audit
│   │   ├── middlewares/          # auth, role, upload, sseAuth, audit
│   │   ├── lib/                  # prisma, redis, logger, sse
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── migrations/
│   │       └── seed.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.jsx, App.jsx
│   │   ├── pages/                # Una página por ruta
│   │   ├── components/           # Layout, etc.
│   │   ├── store/                # authStore (Zustand)
│   │   ├── services/             # api.js
│   │   ├── hooks/                # useSSE, etc.
│   │   └── lib/
│   └── package.json
├── nginx/                        # Config Nginx (whatsend.app)
├── deploy/                       # Scripts y configs de despliegue
└── docs/                         # Documentación (este archivo, seguridad, backup)
```

---

## 8. Cómo arrancar en local (resumen)

- **Backend:** `cd backend && npm install && cp .env.production .env` (o crear `.env` con `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`), `npx prisma migrate dev`, `npx prisma db seed`, `npm run dev` (puerto 3001).
- **Frontend:** `cd frontend && npm install && npm run dev` (Vite, normalmente puerto 5173); `VITE_API_URL=http://localhost:3001` si el backend está en otra URL.
- **Requisitos:** Node >= 20, PostgreSQL y Redis accesibles (por ejemplo con Docker o instalados en local).

---

## 9. Documentación adicional

- **Seguridad login/contraseñas:** `docs/SECURITY-LOGIN.md`
- **Backup y persistencia de datos:** `docs/BACKUP-DATOS.md`
- **Despliegue (orden, SSL, checklist):** `deploy/README-DEPLOY.md`, `deploy/INSTRUCCIONES-DEPLOY.md`
- **Checklist pre-Hetzner:** `deploy/CHECKLIST-HETZNER.md`

---

*Documento pensado para onboarding de desarrolladores y alineación técnica con perfiles senior.*
