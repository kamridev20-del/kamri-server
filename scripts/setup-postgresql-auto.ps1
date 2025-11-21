# Script PowerShell automatique pour configurer PostgreSQL
# Sans confirmation, pour execution automatique

Write-Host "=== Configuration PostgreSQL pour KAMRI (Automatique) ===" -ForegroundColor Cyan
Write-Host ""

# Aller dans le dossier server
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptPath "..")

# Fermer les processus Node.js qui pourraient bloquer
Write-Host "Verification des processus bloquants..." -ForegroundColor Yellow
$nodeProcesses = Get-Process | Where-Object { $_.ProcessName -like "*node*" -and $_.Path -like "*$PWD*" } | Where-Object { $_.MainWindowTitle -eq "" }
if ($nodeProcesses) {
    Write-Host "  Fermeture des processus Node.js..." -ForegroundColor Yellow
    $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Charger les variables d'environnement depuis .env
if (Test-Path .env) {
    Write-Host "Chargement des variables depuis .env..." -ForegroundColor Yellow
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
} else {
    Write-Host "ERREUR: Fichier .env non trouve" -ForegroundColor Red
    exit 1
}

# Verifier si DATABASE_URL est defini
if (-not $env:DATABASE_URL) {
    Write-Host "ERREUR: DATABASE_URL n'est pas defini" -ForegroundColor Red
    exit 1
}

Write-Host "OK: DATABASE_URL trouve" -ForegroundColor Green
Write-Host ""

# Copier le schema PostgreSQL
Write-Host "Copie du schema PostgreSQL..." -ForegroundColor Yellow
if (Test-Path "prisma/schema.postgresql.prisma") {
    Copy-Item prisma/schema.postgresql.prisma prisma/schema.prisma -Force
    Write-Host "  Schema copie" -ForegroundColor Green
}

# Nettoyer les fichiers temporaires Prisma
$prismaTempPath = "node_modules\.prisma\client"
if (Test-Path $prismaTempPath) {
    Write-Host "Nettoyage des fichiers temporaires..." -ForegroundColor Yellow
    Get-ChildItem -Path $prismaTempPath -Filter "*.tmp*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}

# Generer le client Prisma
Write-Host "Generation du client Prisma..." -ForegroundColor Yellow
pnpm prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Echec de la generation du client Prisma" -ForegroundColor Red
    Write-Host "  Essayez de fermer Prisma Studio et tous les processus Node.js" -ForegroundColor Yellow
    Write-Host "  Puis executez: pnpm scripts/fix-prisma-lock.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "  Client Prisma genere avec succes" -ForegroundColor Green
Write-Host ""

# Creer les tables
Write-Host "Creation des tables PostgreSQL..." -ForegroundColor Yellow
pnpm prisma db push
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Echec de la creation des tables" -ForegroundColor Red
    exit 1
}

Write-Host "  Tables creees avec succes" -ForegroundColor Green
Write-Host ""

# Seed (optionnel, ne pas echouer si deja execute)
Write-Host "Execution du seed (donnees initiales)..." -ForegroundColor Yellow
pnpm prisma db seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ATTENTION: Erreur lors du seed (peut etre normal si deja execute)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Configuration terminee avec succes! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Cyan
Write-Host "  - Verifiez les tables: pnpm db:studio"
Write-Host "  - Si vous avez des donnees SQLite: pnpm db:migrate-data"
Write-Host "  - Demarrer le serveur: pnpm start:dev"

