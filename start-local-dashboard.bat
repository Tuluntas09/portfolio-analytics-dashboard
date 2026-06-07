@echo off
setlocal

:: Quant Portfolio Analytics Dashboard — local daily launcher
:: Double-click this file from File Explorer to start the full local stack.
::
:: What this does:
::   1. Opens a terminal for the Node.js market-data proxy (port 8787)
::   2. Opens a terminal for the Vite dev server    (port 8502)
::   3. Opens the dashboard in your default browser
::
:: Requirements:
::   - Node.js 18+ installed and on PATH
::   - .env.local exists in this folder with FINNHUB_API_KEY=<your key>
::   - npm install has been run at least once
::
:: To stop: close both terminal windows.

cd /d "%~dp0"

echo.
echo  Quant Portfolio Analytics Dashboard
echo  ------------------------------------
echo.

:: Check that .env.local exists
if not exist ".env.local" (
    echo  WARNING: .env.local not found.
    echo  The proxy will start but live data will not be available.
    echo  Create .env.local with: FINNHUB_API_KEY=your_key_here
    echo.
    timeout /t 3 /nobreak > nul
)

echo  [1/3] Starting market-data proxy on http://127.0.0.1:8787 ...
start "QPA Proxy  ^| http://127.0.0.1:8787/api/health" cmd /k "cd /d "%~dp0" && node server/market-data-server.mjs"

echo  [2/3] Waiting for proxy to initialize...
timeout /t 3 /nobreak > nul

echo  [3/3] Starting Vite frontend on http://127.0.0.1:8502 ...
start "QPA Frontend  ^| http://127.0.0.1:8502" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo  Waiting for Vite to compile...
timeout /t 6 /nobreak > nul

echo  Opening dashboard in browser...
start "" "http://127.0.0.1:8502"

echo.
echo  -------------------------------------------------------
echo   Dashboard : http://127.0.0.1:8502
echo   Proxy     : http://127.0.0.1:8787/api/health
echo  -------------------------------------------------------
echo   Close both terminal windows to stop the dashboard.
echo  -------------------------------------------------------
echo.

endlocal
