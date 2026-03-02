# WhatSend - Subir codigo (comprimido) y ejecutar despliegue
# Sube un ZIP sin node_modules/.git = mas rapido y una sola conexion (no pide clave a mitad)
# Ejecutar desde la carpeta del proyecto: .\deploy\subir-y-ejecutar.ps1

$ErrorActionPreference = "Stop"
$IP = "89.167.78.215"
$REMOTE_DIR = "/var/www/whatsend"
$ZIP_NAME = "whatsend-subida.zip"
$TEMP_DIR = "whatsend-temp-subida"

Write-Host "======================================"
Write-Host " WhatSend - Subir y desplegar"
Write-Host " Servidor: root@$IP"
Write-Host "======================================"
Write-Host ""

if (-not (Test-Path "deploy\setup-server.sh")) {
    Write-Host "ERROR: Ejecuta desde la carpeta del proyecto (donde esta deploy)." -ForegroundColor Red
    exit 1
}

# 1. Crear carpeta en el servidor
Write-Host "[1/5] Creando carpeta en el servidor..."
ssh "root@$IP" "mkdir -p $REMOTE_DIR"
Write-Host ""

# 2. Preparar zip (sin node_modules, .git, dist, etc.)
Write-Host "[2/5] Preparando archivos (excl. node_modules, .git, dist)..."
if (Test-Path $TEMP_DIR) { Remove-Item -Recurse -Force $TEMP_DIR }
New-Item -ItemType Directory -Path $TEMP_DIR | Out-Null
$excludeDirs = @("node_modules", ".git", "dist", "uploads", "wwebjs_auth", "backups", ".cursor")
& robocopy . $TEMP_DIR /E /NFL /NDL /NJH /NJS /NC /NS /XD $excludeDirs | Out-Null
if ($LASTEXITCODE -ge 8) { exit 1 }
Get-ChildItem -Path $TEMP_DIR -Recurse -Filter ".env*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
if (Test-Path $ZIP_NAME) { Remove-Item -Force $ZIP_NAME }
$items = Get-ChildItem -Path $TEMP_DIR
Compress-Archive -Path $items.FullName -DestinationPath $ZIP_NAME -CompressionLevel Optimal
Remove-Item -Recurse -Force $TEMP_DIR
Write-Host "      Zip listo."
Write-Host ""

# 3. Subir UN solo archivo (una conexion)
Write-Host "[3/5] Subiendo zip al servidor..."
scp $ZIP_NAME "root@${IP}:${REMOTE_DIR}/"
Remove-Item -Force $ZIP_NAME -ErrorAction SilentlyContinue
Write-Host ""

# 4. Descomprimir en el servidor
Write-Host "[4/5] Descomprimiendo en el servidor..."
$remoteUnzip = "cd $REMOTE_DIR; unzip -o -q $ZIP_NAME; rm -f $ZIP_NAME"
ssh "root@$IP" $remoteUnzip
Write-Host ""

# 5. Ejecutar primera vez / deploy
Write-Host "[5/5] Ejecutando instalacion y deploy en el servidor..."
$remoteCmd = "cd $REMOTE_DIR; bash deploy/primera-vez.sh"
ssh -t "root@$IP" $remoteCmd
Write-Host ""
Write-Host "Listo. App: https://whatsend.app"
