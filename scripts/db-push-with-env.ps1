# Script pour executer prisma db push avec les variables d'environnement chargees

Write-Host "Chargement des variables depuis .env..." -ForegroundColor Yellow

# Charger les variables d'environnement depuis .env
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "OK: Variables chargees" -ForegroundColor Green
} else {
    Write-Host "ERREUR: Fichier .env non trouve" -ForegroundColor Red
    exit 1
}

# Verifier DATABASE_URL
if (-not $env:DATABASE_URL) {
    Write-Host "ERREUR: DATABASE_URL n'est pas defini" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Execution de: prisma db push" -ForegroundColor Cyan
Write-Host ""

# Executer prisma db push
pnpm prisma db push

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "OK: Tables creees avec succes!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ERREUR: Echec de la creation des tables" -ForegroundColor Red
    exit 1
}

