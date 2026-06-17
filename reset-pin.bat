@echo off
setlocal
title MercadoPDV - Forcar PIN 1234

echo ============================================
echo   MERCADOPDV - RESET DE PIN OFFLINE
echo ============================================
echo.

set "DB_PATH=%APPDATA%\MercadoPDV\mercadopdv.db"
set "SQLITE_EXE=%~dp0sqlite3.exe"

REM 1. Verificar se o sqlite3.exe esta na pasta
if not exist "%SQLITE_EXE%" (
    echo [ERRO] O arquivo sqlite3.exe nao foi encontrado nesta pasta!
    echo Copie o sqlite3.exe para junto deste arquivo .bat
    pause
    exit /b
)

REM 2. Verificar se o banco existe
if not exist "%DB_PATH%" (
    echo [ERRO] Banco de dados nao encontrado em:
    echo "%DB_PATH%"
    echo.
    echo Abra o sistema MercadoPDV pelo menos uma vez antes de rodar.
    pause
    exit /b
)

echo [OK] Banco encontrado.
echo [OK] Ferramenta SQLite encontrada.
echo.

REM 3. O Hash SHA256 de '1234'
set "HASH=03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"

echo Aplicando PIN 1234 ao administrador...
"%SQLITE_EXE%" "%DB_PATH%" "UPDATE operadores SET pin_hash='%HASH%', ativo=1 WHERE id=1;"

if %errorlevel% neq 0 (
    echo [ERRO] Falha ao executar comando no banco. O sistema esta aberto?
    echo Feche o MercadoPDV antes de rodar este script.
    pause
    exit /b
)

echo.
echo ============================================
echo   SUCESSO! O PIN foi forçado para: 1234
echo ============================================
echo.
echo Verificando dados gravados:
"%SQLITE_EXE%" "%DB_PATH%" "SELECT nome, nivel_acesso FROM operadores WHERE id=1;"
echo.

pause
