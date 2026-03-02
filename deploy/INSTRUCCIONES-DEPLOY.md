# WhatSend — Instrucciones de despliegue (paso a paso)

**Servidor:** IP `89.167.78.215` (comandos ya preparados con esta IP).

---

## Opción rápida: un solo script (primera vez)

**PowerShell (tu PC)** — desde la carpeta del proyecto (donde está la carpeta `deploy`):

```powershell
.\deploy\subir-y-ejecutar.ps1
```

El script **comprime el proyecto** (sin node_modules, .git, dist) en un ZIP, **sube un solo archivo** (más rápido y sin que pida la clave a mitad de subida) y luego ejecuta la instalación en el servidor. Solo tienes que escribir la contraseña de root cuando te la pida (y en el servidor: editar `.env` con nano y el email para Certbot).

**Si la subida sigue pidiendo la clave varias veces o es muy lenta:** configura **clave SSH** (una vez) y usa ese usuario en los scripts. Ver **`deploy/SSH-CLAVE-WINDOWS.md`**.

---

## Paso a paso (manual)

Cada paso indica **dónde** ejecutar el comando:
- **PowerShell** = en tu PC con Windows (terminal de Cursor o PowerShell).
- **SSH (servidor)** = dentro de la sesión SSH conectado al servidor (Ubuntu en Hetzner).

---

## Primera vez: preparar servidor y subir la app

### 1. Conectar al servidor por SSH

**PowerShell (tu PC)**

```powershell
ssh root@89.167.78.215
```

(Si usas clave SSH: `ssh -i ruta\a\tu-clave.pem root@89.167.78.215`)

A partir de aquí, todos los comandos son **en la sesión SSH (servidor)** hasta que se indique otra cosa.

---

### 2. Subir el código del proyecto al servidor (primero, para tener el script de setup)

**Opción A — Desde tu PC con PowerShell (SCP)**

Antes de SCP, crear la carpeta en el servidor. **SSH (servidor):**

```bash
sudo mkdir -p /var/www/whatsend
```

Luego **PowerShell (tu PC)** — en la carpeta del proyecto (ej. `C:\Users\hidal\Downloads\whatsend`)

```powershell
scp -r . root@89.167.78.215:/var/www/whatsend/
```

(Si usas clave SSH: `scp -i ruta\a\tu-clave.pem -r . root@89.167.78.215:/var/www/whatsend/`)

**Opción B — Desde el servidor con Git**

**SSH (servidor)**

```bash
sudo mkdir -p /var/www/whatsend
cd /var/www/whatsend
sudo git clone https://github.com/TU_USUARIO/whatsend.git .
```

(Sustituye la URL por tu repositorio. Si el repo es privado, configura SSH o token en el servidor.)

---

### 3. Instalar Node, PostgreSQL, Redis, Nginx, Certbot (solo primera vez)

**SSH (servidor)**

```bash
cd /var/www/whatsend
sudo bash deploy/setup-server.sh
```

---

### 4. Configurar variables de entorno en el servidor (solo primera vez)

**SSH (servidor)**

```bash
cd /var/www/whatsend
sudo cp backend/.env.production backend/.env
sudo nano backend/.env
```

Edita y guarda:
- `INITIAL_ADMIN_PASSWORD` = contraseña del primer usuario admin (cámbiala).
- El resto (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, etc.) ya puede venir en `.env.production`; en el servidor suele ser igual. Comprueba que `FRONTEND_URL=https://whatsend.app`.

Salir de nano: `Ctrl+O`, Enter, `Ctrl+X`.

---

### 5. Obtener certificados SSL (solo primera vez)

**SSH (servidor)**

```bash
cd /var/www/whatsend
sudo cp deploy/nginx-whatsend-step1-para-certbot.conf /etc/nginx/sites-available/whatsend.app
sudo ln -sf /etc/nginx/sites-available/whatsend.app /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d whatsend.app -d www.whatsend.app
```

Luego poner la config definitiva con HTTPS y redirecciones:

```bash
sudo cp nginx/whatsend.app.conf /etc/nginx/sites-available/whatsend.app
sudo nginx -t && sudo systemctl reload nginx
```

---

### 6. Arrancar la app (deploy) — primera vez y cada actualización

**SSH (servidor)**

```bash
cd /var/www/whatsend
sudo bash deploy/deploy-app.sh
```

Con esto la app queda en **https://whatsend.app** y el backup diario (cron) queda instalado.

---

## Siguientes veces: solo actualizar código

**1. Subir código nuevo**

**PowerShell (tu PC)** — si usas SCP:

```powershell
scp -r . root@89.167.78.215:/var/www/whatsend/
```

**SSH (servidor)** — si usas Git:

```bash
cd /var/www/whatsend
sudo git pull
```

**2. Volver a desplegar**

**SSH (servidor)**

```bash
cd /var/www/whatsend
sudo bash deploy/deploy-app.sh
```

---

## Resumen rápido

| Dónde        | Qué hacer |
|-------------|-----------|
| **PowerShell** | Conectar por SSH, subir código con `scp` (si no usas Git en el servidor). |
| **SSH (servidor)** | `setup-server.sh`, configurar `.env`, SSL (certbot), y **siempre** `deploy/deploy-app.sh` para arrancar o actualizar. |

Todo lo que sea “instalar en el servidor”, “nginx”, “pm2”, “cron” y “deploy” se ejecuta **en SSH (servidor)**. En **PowerShell** solo: conectarte por SSH y, si quieres, enviar archivos con `scp`.
