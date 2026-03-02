# Dejar la web funcionando en el servidor (un solo comando)

Si ya clonaste el repo en `/var/www/whatsend` y quieres que la web quede lista (backend, frontend, Nginx, SSL):

## En el servidor (por SSH)

```bash
cd /var/www/whatsend
sudo bash deploy/listo-web.sh
```

El script:

1. Instala PostgreSQL, Redis, Nginx y Certbot si no están.
2. Crea el usuario y la base de datos `whatsend` en PostgreSQL (con la contraseña del template).
3. Configura Redis con la contraseña que usa el template.
4. Crea `backend/.env` desde `deploy/env.production.template` si no existe.
5. Instala dependencias del backend, ejecuta migraciones y seed.
6. Compila el frontend (`npm run build`).
7. Configura Nginx (primero solo HTTP en el puerto 80).
8. Reinicia o arranca el backend con PM2.
9. Obtiene el certificado SSL con Certbot (si el dominio ya apunta al servidor) y activa la config Nginx con HTTPS.

Si Certbot falla (por ejemplo el DNS aún no apunta), la web queda en **http://whatsend.app**. Cuando el DNS esté bien, ejecuta:

```bash
sudo certbot --nginx -d whatsend.app -d www.whatsend.app
sudo cp /var/www/whatsend/nginx/whatsend.app.conf /etc/nginx/sites-available/whatsend.app
sudo nginx -t && sudo systemctl reload nginx
```

## Cambiar la contraseña del admin antes del primer uso

Edita `backend/.env` y cambia `INITIAL_ADMIN_PASSWORD` antes de que se ejecute el seed (o después ejecuta el script `backend/scripts/set-admin-password.js` con la nueva contraseña).

## Email para Certbot

Por defecto usa `admin@whatsend.app`. Para otro email:

```bash
CERTBOT_EMAIL=tu@email.com sudo bash deploy/listo-web.sh
```
