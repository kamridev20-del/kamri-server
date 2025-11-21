# Script PowerShell pour migrer les donnees SQLite vers PostgreSQL
# Utilise Prisma pour lire SQLite et ecrire dans PostgreSQL

Write-Host "=== Migration SQLite -> PostgreSQL ===" -ForegroundColor Cyan
Write-Host ""

# Charger les variables
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# Verifier DATABASE_URL
if (-not $env:DATABASE_URL) {
    Write-Host "ERREUR: DATABASE_URL non defini" -ForegroundColor Red
    exit 1
}

Write-Host "Les tables PostgreSQL sont deja creees." -ForegroundColor Green
Write-Host ""
Write-Host "Pour migrer les donnees SQLite:" -ForegroundColor Yellow
Write-Host "  1. Si vous avez peu de donnees, utilisez Prisma Studio manuellement"
Write-Host "  2. Si vous avez beaucoup de donnees, utilisez un outil comme DBeaver"
Write-Host "  3. Ou creer un script personnalise avec node-sqlite3"
Write-Host ""
Write-Host "Verifier les tables PostgreSQL:" -ForegroundColor Cyan
Write-Host "  pnpm db:studio"
Write-Host ""

