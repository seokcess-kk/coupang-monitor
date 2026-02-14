@echo off
REM Chrome Debug Mode Launcher for PriceWatch Scraper
REM Uses a separate profile to avoid conflicts with existing Chrome

set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
set DEBUG_PORT=9222
set USER_DATA_DIR=%USERPROFILE%\.pricewatch-chrome

echo ========================================
echo  PriceWatch - Chrome Debug Mode
echo ========================================
echo.
echo Using separate Chrome profile for scraping.
echo Profile: %USER_DATA_DIR%
echo Port: %DEBUG_PORT%
echo.

REM Check if debug port is already in use
netstat -an | findstr ":%DEBUG_PORT%" > nul
if %errorlevel% == 0 (
    echo Chrome Debug mode is already running!
    echo You can now run the scraper.
    echo.
    pause
    exit /b 0
)

REM Create profile directory if not exists
if not exist "%USER_DATA_DIR%" mkdir "%USER_DATA_DIR%"

REM Start Chrome with remote debugging (separate profile)
echo Starting Chrome...
start "" %CHROME_PATH% ^
    --remote-debugging-port=%DEBUG_PORT% ^
    --user-data-dir="%USER_DATA_DIR%" ^
    --no-first-run ^
    --no-default-browser-check ^
    --disable-background-networking ^
    --lang=ko-KR ^
    "https://www.coupang.com"

echo.
echo Chrome started with Debug mode!
echo.
echo ========================================
echo  Next Steps:
echo ========================================
echo 1. Login to Coupang (if needed)
echo 2. Run scraper: pnpm scraper:run --all
echo.
pause
