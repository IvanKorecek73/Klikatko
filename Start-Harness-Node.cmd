@echo off
setlocal

cd /d "%~dp0"

set "HARNESS_PORT=%PORT%"
if not defined HARNESS_PORT set "HARNESS_PORT=5096"

set "HARNESS_TARGET=%~1"
if not defined HARNESS_TARGET set "HARNESS_TARGET=http://localhost:5087"

if not defined HARNESS_PROXY_TIMEOUT_MS set "HARNESS_PROXY_TIMEOUT_MS=30000"
if not defined REDIS_BRIDGE_PORT set "REDIS_BRIDGE_PORT=5097"
if not defined REDIS_CONNECTION_STRING set "REDIS_CONNECTION_STRING=localhost:6379,abortConnect=false"

set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%NODE_EXE%" (
  set "NODE_FOUND=1"
) else (
  set "NODE_EXE=node"
  where node >nul 2>nul
  if not errorlevel 1 set "NODE_FOUND=1"
)

if not defined NODE_FOUND (
  echo.
  echo Node.js nebyl nalezen v PATH.
  echo Nainstalujte Node.js a zkuste to znovu.
  echo.
  pause
  exit /b 1
)

set "PORT=%HARNESS_PORT%"
set "TICKET_SERVICE_BASE_URL=%HARNESS_TARGET%"

echo.
echo Klikatko poběží na: http://localhost:%PORT%
echo Vychozi proxy target: %TICKET_SERVICE_BASE_URL%
echo Redis bridge: http://127.0.0.1:%REDIS_BRIDGE_PORT%
echo Prostredi lze potom prepinat primo v UI.
echo.

start "Klikatko Redis Bridge" /min "%NODE_EXE%" tools\redis-bridge\src\server.js
start "" "http://localhost:%PORT%"
"%NODE_EXE%" server.js

endlocal
