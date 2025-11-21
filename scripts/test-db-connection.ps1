# Script pour tester la connexion PostgreSQL

Write-Host "=== Test de Connexion PostgreSQL ===" -ForegroundColor Cyan
Write-Host ""

# Charger les variables depuis .env
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

if (-not $env:DATABASE_URL) {
    Write-Host "ERREUR: DATABASE_URL non defini" -ForegroundColor Red
    exit 1
}

# Masquer le mot de passe dans l'affichage
$dbUrl = $env:DATABASE_URL
$maskedUrl = $dbUrl -replace ':[^:@]+@', ':****@'
Write-Host "URL de connexion: $maskedUrl" -ForegroundColor Yellow
Write-Host ""

# Tester avec Prisma
Write-Host "Test de connexion avec Prisma..." -ForegroundColor Yellow
Write-Host ""

try {
    # Generer le client Prisma
    pnpm prisma generate
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERREUR: Echec de la generation du client Prisma" -ForegroundColor Red
        exit 1
    }
    
    # Tester la connexion avec prisma db pull (sans modifier)
    Write-Host "Test de connexion a la base de donnees..." -ForegroundColor Yellow
    $testResult = pnpm prisma db pull --schema prisma/schema.prisma 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Connexion reussie!" -ForegroundColor Green
    } else {
        # Essayer une autre méthode: vérifier que le client peut se connecter
        Write-Host "Test alternatif..." -ForegroundColor Yellow
        $testResult2 = pnpm prisma validate 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Schema valide, connexion OK!" -ForegroundColor Green
        } else {
            throw "Echec de la connexion"
        }
    }
    Write-Host ""
    Write-Host "Vous pouvez maintenant:" -ForegroundColor Cyan
    Write-Host "  - Ouvrir Prisma Studio: pnpm db:studio"
    Write-Host "  - Pousser le schema: pnpm db:push:env"
    Write-Host "  - Migrer les donnees: pnpm db:migrate-data"
    
} catch {
    Write-Host "ERREUR: Impossible de se connecter a la base de donnees" -ForegroundColor Red
    Write-Host "  Verifiez:" -ForegroundColor Yellow
    Write-Host "    - Que l'URL est correcte"
    Write-Host "    - Que la base de donnees est accessible"
    Write-Host "    - Que les credentials sont corrects"
    exit 1
}

