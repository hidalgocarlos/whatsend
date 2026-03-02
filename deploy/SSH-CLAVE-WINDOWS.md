# Configurar clave SSH para no escribir la contraseña en cada subida

Si usas **contraseña** para SSH/SCP, la conexión puede cortarse en subidas largas y te pide la clave otra vez. Con **clave SSH** solo la configuras una vez y no te pedirá la contraseña al subir.

---

## 1. Generar una clave SSH (en tu PC, una sola vez)

**PowerShell (tu PC):**

```powershell
ssh-keygen -t ed25519 -C "whatsend-hetzner" -f "$env:USERPROFILE\.ssh\whatsend_hetzner"
```

- Cuando pregunte *Passphrase*, puedes dejarla en blanco (Enter) o poner una para más seguridad.
- Se crean dos archivos:
  - `C:\Users\TuUsuario\.ssh\whatsend_hetzner` (clave privada, no la compartas)
  - `C:\Users\TuUsuario\.ssh\whatsend_hetzner.pub` (clave pública, esta la subes al servidor)

---

## 2. Copiar la clave pública al servidor

**PowerShell (tu PC)** — te pedirá la contraseña del servidor **solo esta vez**:

```powershell
type $env:USERPROFILE\.ssh\whatsend_hetzner.pub | ssh root@89.167.78.215 "mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys"
```

(Escribe la contraseña de root cuando la pida.)

---

## 3. Probar que entra sin contraseña

**PowerShell:**

```powershell
ssh -i $env:USERPROFILE\.ssh\whatsend_hetzner root@89.167.78.215 "echo OK"
```

Si sale `OK` sin pedir contraseña, ya está.

---

## 4. Usar la clave en los scripts de subida

Para que `scp` y `ssh` usen siempre esta clave con tu servidor, crea o edita el archivo de config de SSH.

**PowerShell:**

```powershell
$configPath = "$env:USERPROFILE\.ssh\config"
$block = @"

Host whatsend
    HostName 89.167.78.215
    User root
    IdentityFile ~/.ssh/whatsend_hetzner
"@
if (-not (Test-Path $configPath)) { New-Item -ItemType File -Path $configPath -Force | Out-Null }
Add-Content -Path $configPath -Value $block
```

A partir de ahora puedes conectarte así:

```powershell
ssh whatsend
scp archivo.zip whatsend:/var/www/whatsend/
```

Y en los scripts (`subir-comprimido.ps1`, `subir-y-ejecutar.ps1`) puedes cambiar `root@89.167.78.215` por `whatsend` para que usen la clave y no pidan contraseña.

---

## Resumen

| Antes | Después |
|-------|--------|
| Cada `scp`/`ssh` pide contraseña | No pide contraseña (usa la clave) |
| Subida larga puede cortarse y pedir de nuevo | Conexión más estable; si subes un zip, una sola conexión |

Recomendado: **clave SSH** + script **subir-comprimido.ps1** (sube un zip sin node_modules/.git, más rápido y una sola conexión).
