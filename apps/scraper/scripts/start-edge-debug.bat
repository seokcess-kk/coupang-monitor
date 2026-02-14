@echo off
REM Edge Debug Mode Launcher for PriceWatch Scraper
REM Use Edge when Chrome is already running

set EDGE_PATH="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set DEBUG_PORT=9222
set USER_DATA_DIR=%USERPROFILE%\.pricewatch-edge

echo ========================================
echo  PriceWatch - Edge Debug Mode
echo ========================================
echo.
echo Using Edge browser for scraping.
echo Profile: %USER_DATA_DIR%
echo Port: %DEBUG_PORT%
echo.

REM Check if debug port is already in use
netstat -an | findstr ":%DEBUG_PORT%" > nul
if %errorlevel% == 0 (
    echo Debug mode is already running!
    echo You can now run the scraper.
    echo.
    pause
    exit /b 0
)

REM Create profile directory if not exists
if not exist "%USER_DATA_DIR%" mkdir "%USER_DATA_DIR%"

REM Start Edge with remote debugging
echo Starting Edge...
start "" %EDGE_PATH% ^
    --remote-debugging-port=%DEBUG_PORT% ^
    --user-data-dir="%USER_DATA_DIR%" ^
    --no-first-run ^
    --lang=ko-KR ^
    "https://www.coupang.com"

echo.
echo Edge started with Debug mode!
echo.
echo ========================================
echo  Next Steps:
echo ========================================
echo 1. Login to Coupang in Edge (if needed)
echo 2. Run scraper: pnpm scraper:run --all
echo.
pause
