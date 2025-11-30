@echo off
REM Script pour appliquer la migration variantId et variantDetails à la base de données
REM Usage: scripts\apply-variant-migration.bat

echo ========================================
echo Application de la migration variantDetails
echo ========================================
echo.

set PGHOST=yamabiko.proxy.rlwy.net
set PGPORT=28846
set PGDATABASE=railway
set PGUSER=postgres
set PGPASSWORD=avUQefgltUYjOGVtXyouUFwtEyeLshdY

cd /d %~dp0\..

echo [1/3] Application des migrations Prisma existantes...
call npx prisma migrate deploy
if %errorlevel% neq 0 (
    echo ⚠️  Erreur lors de l'application des migrations Prisma
    echo Continuation avec la migration SQL directe...
)

echo.
echo [2/3] Application de la migration SQL pour variantId et variantDetails...
set PGPASSWORD=%PGPASSWORD%
psql -h %PGHOST% -U %PGUSER% -p %PGPORT% -d %PGDATABASE% -f "%~dp0add-variant-details-to-cart.sql"
if %errorlevel% neq 0 (
    echo ❌ Erreur lors de l'application de la migration SQL
    echo.
    echo 💡 Vérifiez que psql est installé et accessible dans le PATH
    echo    Ou exécutez manuellement:
    echo    PGPASSWORD=%PGPASSWORD% psql -h %PGHOST% -U %PGUSER% -p %PGPORT% -d %PGDATABASE% -f "%~dp0add-variant-details-to-cart.sql"
    pause
    exit /b 1
)

echo.
echo [3/3] Génération du client Prisma...
call npx prisma generate
if %errorlevel% neq 0 (
    echo ❌ Erreur lors de la génération du client Prisma
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ Migration appliquée avec succès !
echo ========================================
echo.
pause


