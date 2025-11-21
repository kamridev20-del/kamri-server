# Script pour liberer les fichiers Prisma verrouilles

Write-Host "Liberation des fichiers Prisma verrouilles..." -ForegroundColor Yellow

# Fermer Prisma Studio s'il est ouvert
$prismaProcesses = Get-Process | Where-Object { $_.ProcessName -like "*node*" -or $_.ProcessName -like "*prisma*" }
if ($prismaProcesses) {
    Write-Host "Fermeture des processus Node.js/Prisma..." -ForegroundColor Yellow
    $prismaProcesses | ForEach-Object {
        Write-Host "  Fermeture: $($_.ProcessName) (PID: $($_.Id))"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

# Supprimer les fichiers temporaires Prisma
$prismaTempPath = "node_modules\.prisma\client"
if (Test-Path $prismaTempPath) {
    Write-Host "Nettoyage des fichiers temporaires Prisma..." -ForegroundColor Yellow
    Get-ChildItem -Path $prismaTempPath -Filter "*.tmp*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}

Write-Host "OK: Fichiers liberes" -ForegroundColor Green
Write-Host ""
Write-Host "Vous pouvez maintenant relancer: pnpm prisma generate" -ForegroundColor Cyan

