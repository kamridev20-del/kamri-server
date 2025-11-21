# Script pour mettre a jour l'URL de la base de donnees

param(
    [Parameter(Mandatory=$true)]
    [string]$NewDatabaseUrl
)

Write-Host "=== Mise a jour de DATABASE_URL ===" -ForegroundColor Cyan
Write-Host ""

# Verifier que le fichier .env existe
if (-not (Test-Path .env)) {
    Write-Host "ERREUR: Fichier .env non trouve" -ForegroundColor Red
    Write-Host "  Creez-le avec: cp .env.production.example .env"
    exit 1
}

# Lire le fichier .env
$envContent = Get-Content .env

# Masquer le mot de passe dans l'affichage
$maskedNew = $NewDatabaseUrl -replace ':[^:@]+@', ':****@'
Write-Host "Nouvelle URL: $maskedNew" -ForegroundColor Yellow
Write-Host ""

# Mettre a jour DATABASE_URL
$updated = $false
$newContent = $envContent | ForEach-Object {
    if ($_ -match '^DATABASE_URL=') {
        $updated = $true
        "DATABASE_URL=`"$NewDatabaseUrl`""
    } else {
        $_
    }
}

# Si DATABASE_URL n'existait pas, l'ajouter
if (-not $updated) {
    Write-Host "DATABASE_URL n'existait pas, ajout..." -ForegroundColor Yellow
    $newContent += "DATABASE_URL=`"$NewDatabaseUrl`""
}

# Sauvegarder
$newContent | Set-Content .env -Encoding UTF8

Write-Host "OK: DATABASE_URL mis a jour" -ForegroundColor Green
Write-Host ""

# Tester la connexion
Write-Host "Test de la nouvelle connexion..." -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File scripts/test-db-connection.ps1

