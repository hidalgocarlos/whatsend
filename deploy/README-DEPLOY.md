# WhatSend — Despliegue en Hetzner (whatsend.app)

## Requisitos para que navegadores y antivirus no marquen error

- **Todo el tráfico por HTTPS (SSL)** — Nginx + Let's Encrypt. Sin HTTP sin cifrar.
- **Cookies de sesión** — `Secure`, `HttpOnly`, `SameSite=Strict` en producción.
- **Contraseñas** — Nunca en el código; solo en variables de entorno en el servidor. En tránsito siempre cifradas (HTTPS).

## Orden recomendado

### 1. Primera vez: servidor y SSL

1. Ejecutar en el servidor (como root):  
   `bash setup-server.sh`
2. Subir el código a `/var/www/whatsend` (git clone o scp).
3. **Configurar variables de entorno (contraseñas cifradas en tránsito vía HTTPS):**
   - Copiar `backend/.env.production` → `backend/.env`
   - **Cambiar** `INITIAL_ADMIN_PASSWORD` antes del primer seed.
   - No subir `.env` a Git (ya está en .gitignore).
4. **Obtener certificados SSL (primera vez):**
   - Copiar la config solo-80:  
     `cp deploy/nginx-whatsend-step1-para-certbot.conf /etc/nginx/sites-available/whatsend.app`  
     `ln -sf /etc/nginx/sites-available/whatsend.app /etc/nginx/sites-enabled/`  
     `nginx -t && systemctl reload nginx`
   - Ejecutar Certbot:  
     `certbot --nginx -d whatsend.app -d www.whatsend.app`
   - Sustituir por la config definitiva con SSL y redirects:  
     `cp nginx/whatsend.app.conf /etc/nginx/sites-available/whatsend.app`  
     `nginx -t && systemctl reload nginx`
5. Ejecutar el deploy: desde `/var/www/whatsend` → `bash deploy/deploy-app.sh`.

### 2. Deploys siguientes

Desde `/var/www/whatsend`: `bash deploy/deploy-app.sh`.  
El script instala deps, migra DB, construye frontend, recarga Nginx y PM2. **Los datos (usuarios, campañas, plantillas, etc.) no se borran**; las migraciones solo añaden cambios al esquema.

### 3. Backup de datos (importante)

- **Backup manual:** `bash deploy/backup-now.sh` (genera en `/var/backups/whatsend/` un volcado de la base de datos y de uploads/sesiones WhatsApp).
- **Backup automático:** Configurar cron (ver `docs/BACKUP-DATOS.md`).
- **Restaurar:** `bash deploy/restore-backup.sh` o `bash deploy/restore-backup.sh /var/backups/whatsend/YYYYMMDD-HHMMSS`.

## Comprobaciones de seguridad

| Revisión | Estado |
|----------|--------|
| HTTP → HTTPS 301 | Nginx (puerto 80 → https://whatsend.app) |
| www → apex 301 | Nginx (www.whatsend.app → whatsend.app) |
| Certificados SSL | Let's Encrypt (fullchain.pem, privkey.pem) |
| HSTS | Nginx: `Strict-Transport-Security` |
| Cookie refreshToken | Backend: `secure: true`, `httpOnly: true`, `sameSite: 'strict'` en producción |
| Access token | Frontend: solo en memoria (no en localStorage) |
| Secrets (JWT, DB, Redis) | Solo en backend `.env` en el servidor |
| CORS | Backend: `FRONTEND_URL=https://whatsend.app` |
| Trust proxy | Backend: `app.set('trust proxy', 1)` en producción |

## Dominio

- Producción: **https://whatsend.app**
- `FRONTEND_URL` y el frontend construido con `VITE_API_URL` vacío = misma origen, todo por HTTPS.
