# Script PowerShell simplifie pour configurer PostgreSQL
# Utilise directement les commandes pnpm sans dependances externes

Write-Host "=== Configuration PostgreSQL pour KAMRI ===" -ForegroundColor Cyan
Write-Host ""

# Aller dans le dossier server
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptPath "..")

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
} elseif (Test-Path .env.production) {
    Write-Host "Chargement des variables depuis .env.production..." -ForegroundColor Yellow
    Get-Content .env.production | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
} else {
    Write-Host "Aucun fichier .env trouve" -ForegroundColor Yellow
}

# Verifier si DATABASE_URL est defini
if (-not $env:DATABASE_URL) {
    Write-Host "ERREUR: DATABASE_URL n'est pas defini" -ForegroundColor Red
    Write-Host "   Definissez-le dans votre fichier .env ou .env.production"
    Write-Host "   Exemple: DATABASE_URL=postgresql://user:password@host:5432/database"
    exit 1
}

Write-Host "OK: DATABASE_URL trouve" -ForegroundColor Green
Write-Host ""

Write-Host "Generation du client Prisma pour PostgreSQL..." -ForegroundColor Yellow
# Copier le schema PostgreSQL
if (Test-Path "prisma/schema.postgresql.prisma") {
    Copy-Item prisma/schema.postgresql.prisma prisma/schema.prisma -Force
    Write-Host "   Schema PostgreSQL copie" -ForegroundColor Green
} else {
    Write-Host "   schema.postgresql.prisma non trouve, utilisation du schema existant" -ForegroundColor Yellow
}

# Generer le client Prisma
Write-Host "   Generation du client Prisma..." -ForegroundColor Yellow
pnpm prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ERREUR lors de la generation du client Prisma" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Poussage du schema vers PostgreSQL..." -ForegroundColor Yellow
Write-Host "ATTENTION: Cette operation va creer/modifier les tables dans votre base de donnees" -ForegroundColor Yellow
$response = Read-Host "Continuer? (y/N)"

if ($response -eq "y" -or $response -eq "Y") {
    Write-Host ""
    Write-Host "   Creation des tables..." -ForegroundColor Yellow
    pnpm prisma db push
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ERREUR lors de la creation des tables" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "Execution du seed (donnees initiales)..." -ForegroundColor Yellow
    pnpm prisma db seed
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ATTENTION: Erreur lors du seed (peut etre normal si deja execute)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Configuration terminee!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prochaines etapes:" -ForegroundColor Cyan
    Write-Host "   1. Verifiez que toutes les tables sont creees"
    Write-Host "   2. Si vous avez des donnees SQLite, executez:"
    Write-Host "      pnpm db:migrate-data"
    Write-Host "   3. Testez la connexion avec: pnpm db:studio"
} else {
    Write-Host "Operation annulee" -ForegroundColor Red
    exit 1
}
