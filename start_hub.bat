@echo off
:: ============================================================
::  UP API HUB  -  Servidor estatico (rede local)
::
::  Serve o index.html para qualquer maquina da rede da UP.
::  Como e' HTML/CSS/JS puro, basta um servidor de arquivos.
::  Requisito: Python instalado (ja usado pela API-UP).
:: ============================================================

cd /d "%~dp0"

:: 8080 costuma estar ocupada pelo EDB Postgres nesta maquina -> usamos 8090
set PORT=8090

:: -- Descobre o IP da maquina na rede local --------------------
for /f %%i in ('powershell -NoProfile -Command ^
  "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*' } | Select-Object -First 1 -ExpandProperty IPAddress)"') do set SERVER_IP=%%i

echo.
echo  ========================================
echo    UP API HUB  ^|  servidor estatico
echo  ========================================
echo.
echo    Nesta maquina:  http://localhost:%PORT%
echo    Na rede local:  http://%SERVER_IP%:%PORT%
echo.
echo    (Ctrl+C para encerrar)
echo.

python -m http.server %PORT% --bind 0.0.0.0
pause
