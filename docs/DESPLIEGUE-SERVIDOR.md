# Cómo bajar el proyecto de GitHub y arrancarlo en el servidor

Pasos muy simples, uno detrás de otro.

---

## Paso 1: Entrar al servidor

Abre la terminal en tu computadora y conéctate al servidor con SSH:

```
ssh root@LA_IP_DE_TU_SERVIDOR
```

(Reemplaza `LA_IP_DE_TU_SERVIDOR` por la IP que te dio Hetzner. Si te pide contraseña, la escribes y das Enter.)

Ya estás “dentro” del servidor.

---

## Paso 2: Ir a una carpeta donde guardar el proyecto

Escribe esto y pulsa Enter:

```
cd /var/www
```

Si esa carpeta no existe, créala:

```
mkdir -p /var/www
cd /var/www
```

---

## Paso 3: Bajar el código de GitHub

Escribe exactamente esto (es la “copia” de tu proyecto en internet):

```
git clone https://github.com/hidalgocarlos/whatsend.git
```

Espera a que termine. Cuando vuelva a salir el cursor, habrá una carpeta que se llama `whatsend`.

Entra dentro de esa carpeta:

```
cd whatsend
```

---

## Paso 4: Preparar el backend (la parte que habla con la base de datos)

Entra en la carpeta del backend:

```
cd backend
```

Copia el archivo de ejemplo de configuración para crear tu archivo de configuración:

```
cp .env.example .env
```

Abre el archivo para editarlo:

```
nano .env
```

Cambia estas líneas con **tus datos de verdad** (la base de datos, Redis, tu dominio, etc.):

- `DATABASE_URL` → la dirección de tu PostgreSQL (usuario, contraseña, nombre de la base).
- `REDIS_URL` → normalmente `redis://localhost:6379`
- `JWT_SECRET` y `JWT_REFRESH_SECRET` → dos frases largas y secretas diferentes.
- `FRONTEND_URL` → la dirección de tu web, por ejemplo `https://tudominio.com`
- `INITIAL_ADMIN_EMAIL` y `INITIAL_ADMIN_PASSWORD` → el correo y la contraseña del primer admin.

Para salir de `nano`: Ctrl+O (guardar), Enter, luego Ctrl+X (salir).

Instala las dependencias del backend:

```
npm ci
```

Crea las tablas en la base de datos:

```
npx prisma migrate deploy
```

Crea el usuario admin inicial (solo la primera vez):

```
node src/prisma/seed.js
```

Vuelve a la carpeta del proyecto (la raíz):

```
cd ..
```

---

## Paso 5: Arrancar el backend para siempre (con PM2)

Sigue en la raíz del proyecto (`/var/www/whatsend`). Entra otra vez en `backend`:

```
cd backend
```

Arranca el backend con PM2 (así sigue funcionando aunque cierres la conexión):

```
pm2 start ecosystem.config.cjs --env production
```

Para que se encienda solo si reinicias el servidor:

```
pm2 save
pm2 startup
```

(Copia y ejecuta el comando que te salga en pantalla cuando hagas `pm2 startup`.)

Vuelve a la raíz:

```
cd ..
```

---

## Paso 6: Preparar el frontend (la parte que ve el usuario)

Entra en la carpeta del frontend:

```
cd frontend
```

Instala dependencias y genera la web lista para producción:

```
npm ci
npm run build
```

Eso deja la web lista en la carpeta `dist`. Vuelve a la raíz:

```
cd ..
```

---

## Paso 7: Servir la web con Nginx (opcional pero recomendado)

Si tienes Nginx instalado, lo configuras para que:

1. Sirva los archivos de `frontend/dist`.
2. Envíe las peticiones que empiecen por `/api` al backend (por ejemplo al puerto 3001).

Tu backend ya está escuchando en el puerto 3001 gracias a PM2. Nginx hará de “portero” para la web y la API.

(La configuración exacta de Nginx depende de si usas dominio, HTTPS, etc.; si quieres, en otro documento te la dejamos paso a paso.)

---

## Resumen en orden

1. Entrar al servidor: `ssh root@LA_IP`
2. Ir a `/var/www` y clonar: `git clone https://github.com/hidalgocarlos/whatsend.git`
3. Entrar al proyecto: `cd whatsend`
4. Backend: `cd backend` → copiar `.env.example` a `.env` → editar `.env` → `npm ci` → `npx prisma migrate deploy` → `node src/prisma/seed.js`
5. Arrancar backend: `pm2 start ecosystem.config.cjs --env production` → `pm2 save` → `pm2 startup`
6. Frontend: `cd ../frontend` → `npm ci` → `npm run build`
7. Configurar Nginx para servir `frontend/dist` y hacer proxy de `/api` al puerto 3001.

Cuando quieras **actualizar** el proyecto (porque subiste cambios a GitHub):

```
cd /var/www/whatsend
git pull origin main
cd backend
npm ci
npx prisma migrate deploy
pm2 restart whatsend-api
cd ../frontend
npm ci
npm run build
```

Así tienes los pasos para “bajar el git de GitHub” y arrancar todo en el servidor, explicado muy paso a paso.
