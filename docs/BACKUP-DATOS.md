# Backup y persistencia de datos — WhatSend

Los datos (usuarios, campañas, plantillas, listas, logs, archivos subidos y sesiones de WhatsApp) **no se borran** al actualizar el código. Además, es importante tener **copias de seguridad** periódicas.

---

## 1. Dónde viven los datos (nunca se pierden al hacer deploy)

| Dato | Dónde está | Se borra al actualizar código |
|------|------------|--------------------------------|
| **Usuarios, campañas, plantillas, listas, contactos, logs, auditoría** | Base de datos PostgreSQL (servidor o contenedor) | **No** |
| **Archivos subidos** (imágenes/audios de plantillas, CSV) | `backend/uploads/` | **No** (carpeta fuera del repo; en servidor vive en disco) |
| **Sesiones WhatsApp** (para no escanear QR cada vez) | `backend/wwebjs_auth/` | **No** (igual que uploads) |

- El **deploy** (`deploy-app.sh`) solo ejecuta **migraciones** (`prisma migrate deploy`), que **añaden** tablas o columnas nuevas; **nunca** borra tablas ni datos.
- El **seed** solo crea el usuario admin **si no existe**; no sobrescribe usuarios ni datos.
- Por tanto, **cambiar o subir código no elimina la base de datos ni los archivos**; los datos persisten.

---

## 2. Backup recomendado (servidor Hetzner)

### Script de backup

En el servidor, desde la raíz del proyecto (`/var/www/whatsend`):

```bash
bash deploy/backup-now.sh
```

Esto genera en **`/var/backups/whatsend/`** (o en `$WHATSEND_BACKUP_DIR` si lo defines) una carpeta con fecha y hora que contiene:

- **`whatsend-db-YYYYMMDD-HHMMSS.sql`** — volcado completo de PostgreSQL (usuarios, **contactos**, campañas, plantillas, listas, logs, auditoría, etc.).
- **`whatsend-files-YYYYMMDD-HHMMSS.tar.gz`** — comprimido de `uploads/` y `wwebjs_auth/`.

El script usa `backend/.env` para leer `DATABASE_URL`. No subas `.env` a Git; debe existir solo en el servidor.

### Rotación

Por defecto se mantienen los últimos **14 días** de backups. Puedes cambiar:

```bash
export WHATSEND_BACKUP_RETENTION_DAYS=30
bash deploy/backup-now.sh
```

O definir la carpeta de backups:

```bash
export WHATSEND_BACKUP_DIR=/ruta/backups
bash deploy/backup-now.sh
```

---

## 3. Backup automático (cron)

**El cron de backup se instala solo** cuando ejecutas el deploy como root:

```bash
sudo bash deploy/deploy-app.sh
```

Se crea `/etc/cron.d/whatsend-backup`: backup **todos los días a las 03:00** en `/var/backups/whatsend/`. No hace falta configurar nada a mano.

Si despliegas sin root, el script te mostrará el comando para añadirlo a `crontab -e` o para volver a ejecutar el deploy con `sudo`.

---

## 4. Restaurar desde un backup

### Restaurar base de datos y archivos

```bash
bash deploy/restore-backup.sh
```

El script listará las carpetas de backup y te pedirá que elijas una. Luego te preguntará si quieres restaurar la base de datos y, si existe, el tar de archivos (uploads y sesiones WhatsApp).

Para indicar directamente la carpeta de backup:

```bash
bash deploy/restore-backup.sh /var/backups/whatsend/20260227-120000
```

**Importante:** La restauración de la base de datos **sobrescribe** los datos actuales. Hazla solo cuando quieras recuperar un backup concreto. Después, reinicia el backend:

```bash
pm2 reload whatsend-api
```

---

## 5. Resumen rápido

| Acción | Comando |
|--------|--------|
| Hacer backup ahora | `bash deploy/backup-now.sh` |
| Restaurar backup | `bash deploy/restore-backup.sh` o `bash deploy/restore-backup.sh /ruta/carpeta-backup` |
| Dónde quedan los backups | Por defecto: `/var/backups/whatsend/` |
| Backup automático diario | Añadir la línea de cron indicada arriba |

Los datos de usuarios, campañas, plantillas y todo lo almacenado en PostgreSQL y en `uploads/` y `wwebjs_auth/` se mantienen al actualizar código y, con los backups, puedes recuperarlos si algo falla en el servidor.
