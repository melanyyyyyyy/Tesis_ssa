@echo off
title Sistema de Gestion SSA - Panel de Control
color 0b

echo ==========================================
echo   INICIANDO PROYECTO SSA (TESIS)
echo ==========================================
echo.

echo [INFO] Limpiando puertos 3000 y 5173 para evitar conflictos...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    if not "%%a"=="0" taskkill /f /pid %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    if not "%%a"=="0" taskkill /f /pid %%a >nul 2>&1
)

echo [OK] Puertos listos.
echo.

if not exist node_modules (
    echo [INFO] No se detectaron librerias. Instalando todo por primera vez...
    call npm run install-all
)

echo.
echo [INFO] Levantando Servidor y Cliente simultaneamente...
echo.

call npm run dev

pause