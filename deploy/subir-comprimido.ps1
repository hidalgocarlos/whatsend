# WhatSend - Subir solo codigo (sin node_modules, .git) en UN archivo zip
# Mas rapido y una sola conexion = no pide la clave a mitad de subida
# Ejecutar desde la carpeta del proyecto: .\deploy\subir-comprimido.ps1

$ErrorActionPreference = "Stop"
$IP = "89.167.78.215"
$REMOTE_DIR = "/var/www/whatsend"
$ZIP_NAME = "whatsend-subida.zip"
$TEMP_DIR = "whatsend-temp-subida"

if (-not (Test-Path "deploy\setup-server.sh")) {
    Write-Host "ERROR: Ejecuta desde la carpeta del proyecto (donde esta deploy)." -ForegroundColor Red
    exit 1
}

Write-Host "======================================"
Write-Host " WhatSend - Subir comprimido (sin node_modules/.git)"
Write-Host " Servidor: root@$IP"
Write-Host "======================================"
Write-Host ""

# 1. Copiar proyecto a carpeta temporal EXCLUYENDO lo que no hace falta
Write-Host "[1/4] Preparando archivos (excluyendo node_modules, .git, dist...)..."
if (Test-Path $TEMP_DIR) { Remove-Item -Recurse -Force $TEMP_DIR }
New-Item -ItemType Directory -Path $TEMP_DIR | Out-Null
$excludeDirs = @("node_modules", ".git", "dist", "uploads", "wwebjs_auth", "backups", ".cursor")
& robocopy . $TEMP_DIR /E /NFL /NDL /NJH /NJS /NC /NS /XD $excludeDirs | Out-Null
if ($LASTEXITCODE -ge 8) { exit 1 }
# Quitar .env del temp por seguridad
Get-ChildItem -Path $TEMP_DIR -Recurse -Filter ".env*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Write-Host "      Listo."
Write-Host ""

# 2. Comprimir en un solo zip
Write-Host "[2/4] Comprimiendo..."
if (Test-Path $ZIP_NAME) { Remove-Item -Force $ZIP_NAME }
$items = Get-ChildItem -Path $TEMP_DIR
Compress-Archive -Path $items.FullName -DestinationPath $ZIP_NAME -CompressionLevel Optimal
Remove-Item -Recurse -Force $TEMP_DIR
$sizeMB = [math]::Round((Get-Item $ZIP_NAME).Length / 1MB, 2)
Write-Host "      $ZIP_NAME ($sizeMB MB)"
Write-Host ""

# 3. Subir UN solo archivo (una conexion, sin pedir clave a mitad)
Write-Host "[3/4] Subiendo zip al servidor (solo pide clave UNA vez)..."
scp $ZIP_NAME "root@${IP}:${REMOTE_DIR}/"
Write-Host "      Subido."
Write-Host ""

# 4. En el servidor: descomprimir y borrar zip
Write-Host "[4/4] Descomprimiendo en el servidor..."
$remoteCmd = "cd $REMOTE_DIR; unzip -o -q $ZIP_NAME; rm -f $ZIP_NAME"
ssh "root@$IP" $remoteCmd
Remove-Item -Force $ZIP_NAME -ErrorAction SilentlyContinue
Write-Host "      Listo."
Write-Host ""
Write-Host "Codigo actualizado en $REMOTE_DIR"
Write-Host "Para desplegar: ssh root@$IP y luego  cd $REMOTE_DIR; sudo bash deploy/deploy-app.sh"
Write-Host "O ejecuta .\deploy\subir-y-ejecutar.ps1 pero cambia el paso 2 por este script."
