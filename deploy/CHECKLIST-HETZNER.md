# Checklist — Revisión línea por línea antes de subir a Hetzner

## 1. Backend (`backend/`)

| Línea / Archivo | Revisión | Estado |
|-----------------|----------|--------|
| `src/index.js` | `trust proxy` solo en producción | OK |
| `src/index.js` | CORS con `FRONTEND_URL` (en prod: `https://whatsend.app`) | OK |
| `src/index.js` | Rate limit en login, refresh, password | OK |
| `src/index.js` | Crea carpeta `uploads` al arrancar; `uploads/templates` la crea el middleware al cargar rutas | OK |
| `src/index.js` | Ruta `/api/health` para comprobar que la API responde | OK |
| `src/controllers/auth.controller.js` | Cookies: `secure` y `sameSite: 'strict'` en producción | OK |
| `src/controllers/auth.controller.js` | JWT leídos de `process.env`; fallan si no están definidos | OK |
| `src/lib/redis.js` | Usa `REDIS_URL`; en producción debe incluir contraseña: `redis://:PASSWORD@127.0.0.1:6379` | Verificar en servidor |
| Migraciones | `npx prisma migrate deploy` en `deploy-app.sh` | OK |

**Acción en el servidor:** El archivo `backend/.env` (copiado desde tu `.env.production` local) debe existir y contener al menos:

- `NODE_ENV=production`
- `FRONTEND_URL=https://whatsend.app`
- `DATABASE_URL=postgresql://whatsend:PASSWORD@localhost:5432/whatsend?schema=public`
- `REDIS_URL=redis://:PASSWORD@127.0.0.1:6379`
- `JWT_SECRET` y `JWT_REFRESH_SECRET` (valores largos y aleatorios)
- `INITIAL_ADMIN_PASSWORD` (solo para el primer seed; después puedes quitarla)

---

## 2. Frontend (`frontend/`)

| Revisión | Estado |
|----------|--------|
| `VITE_API_URL` vacío en producción = peticiones a la misma origen (HTTPS) | OK (`.env.production` con `VITE_API_URL=`) |
| Token en memoria (`getAccessToken()`), no en `localStorage` | OK (`api.js`) |
| SSE (QR, progreso campaña) usan `getAccessToken()` | OK (revisado en conversación previa) |
| Build: `npm run build` → `frontend/dist` | OK |

**En el servidor:** No hace falta `.env` en frontend para el build si ya compilas con `VITE_API_URL=` (o sin definir). El `deploy-app.sh` hace `npm run build` en el servidor; si no existe `frontend/.env.production`, Vite usará valores por defecto y `VITE_API_URL` será `undefined` → `''` en el código. Crea en el servidor `frontend/.env.production` con solo `VITE_API_URL=` para asegurar misma origen.

---

## 3. Nginx (`nginx/whatsend.app.conf`)

| Revisión | Estado |
|----------|--------|
| Puerto 80 → 301 a `https://whatsend.app` | OK |
| www → 301 a apex | OK |
| SSL: fullchain.pem + privkey.pem (Certbot) | OK |
| Headers: HSTS, X-Frame-Options, etc. | OK |
| `location /api/` → proxy a `127.0.0.1:3001` con `X-Forwarded-Proto https` | OK |
| SSE: `proxy_buffering off`, `Connection ''`, timeouts 3600s | OK |
| Frontend: `root /var/www/whatsend/frontend/dist`; `try_files` para SPA | OK |
| `client_max_body_size 25M` para subida de medios | OK |

---

## 4. Scripts de despliegue

| Archivo | Revisión | Estado |
|---------|----------|--------|
| `deploy/setup-server.sh` | Instala Node 22, PM2, PostgreSQL, Redis, Nginx, Certbot, dependencias Puppeteer | OK |
| `deploy/setup-server.sh` | **Contraseñas:** Crea usuario PostgreSQL y Redis con contraseñas fijas. Si el repo es público, cambia esas contraseñas por placeholders y configura a mano en el servidor. | Revisar si repo público |
| `deploy/deploy-app.sh` | Instala deps backend/frontend, migra DB, seed, build, Nginx, PM2 | OK |
| `deploy/deploy-app.sh` | PM2 arranca desde `backend/`; el backend lee `backend/.env` | OK |
| `deploy/nginx-whatsend-step1-para-certbot.conf` | Solo puerto 80 para que Certbot valide; luego reemplazar por `whatsend.app.conf` | OK |
| `deploy/README-DEPLOY.md` | Orden: setup → subir código → SSL (step1 + certbot + config definitiva) → deploy-app | OK |

---

## 5. Seguridad y archivos que NO subir

| Revisión | Estado |
|----------|--------|
| `.gitignore` incluye `.env`, `.env.production`, `backend/.env.production`, `frontend/.env.production` | OK |
| No subir nunca `.env` ni `.env.production` a Git; crearlos solo en el servidor | Verificar antes de push |
| No hay credenciales hardcodeadas en código (solo en `setup-server.sh`; ver nota arriba) | OK |

---

## 6. Comprobaciones rápidas en el servidor tras el deploy

1. **Health:** `curl -s https://whatsend.app/api/health` → `{"ok":true,"service":"whatsend-api"}`
2. **Login:** Abrir `https://whatsend.app`, iniciar sesión con el usuario creado por el seed.
3. **WhatsApp:** Conectar WhatsApp (QR) y comprobar que el estado se ve en verde.
4. **Logs:** `pm2 logs whatsend-api` sin errores de DB o Redis.

---

## Resumen

- **Código y config:** Listos para subir (backend, frontend, nginx, scripts).
- **En el servidor:** Crear `backend/.env` (desde tu `.env.production` o con las variables listadas arriba) y opcionalmente `frontend/.env.production` con `VITE_API_URL=`.
- **Si el repositorio es o será público:** Sustituir en `setup-server.sh` las contraseñas de PostgreSQL y Redis por placeholders y documentar que se configuran manualmente en el servidor (y en `backend/.env`).

Cuando todo esté listo, sube el código a Hetzner y ejecuta en orden: `setup-server.sh` (solo primera vez) → SSL (step1 + certbot + nginx/whatsend.app.conf) → `deploy/deploy-app.sh`.
