@echo off
REM PriceWatch Scraper - Windows runner
REM Double-click to run a full scrape

cd /d "%~dp0\.."

echo ===================================================
echo   PriceWatch Scraper
echo ===================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Run the scraper
echo Starting scraper...
echo.
call npx tsx src/entry/cli.ts run --all

echo.
echo ===================================================
echo Done!
echo ===================================================
pause
