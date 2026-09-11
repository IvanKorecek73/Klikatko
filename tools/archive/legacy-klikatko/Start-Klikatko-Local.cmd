@echo off
setlocal
cd /d "%~dp0"
set "PORT=5095"

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $c = [Net.Sockets.TcpClient]::new('127.0.0.1', %PORT%); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  start "" "http://127.0.0.1:%PORT%/"
  exit /b 0
)

start "" "http://127.0.0.1:%PORT%/"
"C:\Users\op3782\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
endlocal
