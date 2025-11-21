# Script PowerShell de configuration PostgreSQL pour KAMRI
# Alternative Windows pour setup-postgresql.sh

Write-Host "🚀 === Configuration PostgreSQL pour KAMRI ===" -ForegroundColor Cyan
Write-Host ""

# Aller dans le dossier server
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptPath "..")

# Charger les variables d'environnement depuis .env
if (Test-Path .env) {
    Write-Host "📋 Chargement des variables depuis .env..." -ForegroundColor Yellow
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
} elseif (Test-Path .env.production) {
    Write-Host "📋 Chargement des variables depuis .env.production..." -ForegroundColor Yellow
    Get-Content .env.production | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
} else {
    Write-Host "⚠️  Aucun fichier .env trouvé" -ForegroundColor Yellow
}

# Vérifier si DATABASE_URL est défini
if (-not $env:DATABASE_URL) {
    Write-Host "❌ DATABASE_URL n'est pas défini" -ForegroundColor Red
    Write-Host "   Définissez-le dans votre fichier .env ou .env.production"
    Write-Host "   Exemple: DATABASE_URL=`"postgresql://user:password@host:5432/database`""
    exit 1
}

Write-Host "✅ DATABASE_URL trouvé" -ForegroundColor Green
Write-Host ""

Write-Host "📦 Installation des dépendances..." -ForegroundColor Yellow
pnpm install

Write-Host ""
Write-Host "🔄 Génération du client Prisma pour PostgreSQL..." -ForegroundColor Yellow
# Copier le schéma PostgreSQL
Copy-Item prisma/schema.postgresql.prisma prisma/schema.prisma -Force

# Générer le client Prisma
pnpm prisma generate

Write-Host ""
Write-Host "📊 Poussage du schéma vers PostgreSQL..." -ForegroundColor Yellow
Write-Host "⚠️  Cette opération va créer/modifier les tables dans votre base de données" -ForegroundColor Yellow
$response = Read-Host "Continuer? (y/N)"

if ($response -eq "y" -or $response -eq "Y") {
    pnpm prisma db push
    
    Write-Host ""
    Write-Host "🌱 Exécution du seed (données initiales)..." -ForegroundColor Yellow
    pnpm prisma db seed
    
    Write-Host ""
    Write-Host "✅ Configuration terminée!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Prochaines étapes:" -ForegroundColor Cyan
    Write-Host "   1. Vérifiez que toutes les tables sont créées"
    Write-Host "   2. Si vous avez des données SQLite, exécutez:"
    Write-Host "      pnpm db:migrate-data"
    Write-Host "   3. Testez la connexion avec: pnpm db:studio"
} else {
    Write-Host "❌ Opération annulée" -ForegroundColor Red
    exit 1
}

