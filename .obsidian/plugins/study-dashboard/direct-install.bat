@echo off
chcp 65001 >nul
title Math Study Dashboard - Direct Install

echo.
echo ===================================================
echo     Math Study Dashboard - Direct Install
echo ===================================================
echo.

echo [1/3] Creating plugin directory...
set "PLUGIN_DIR=%APPDATA%\Obsidian\plugins\math-study-dashboard"

if not exist "%APPDATA%\Obsidian\plugins" (
    mkdir "%APPDATA%\Obsidian\plugins"
    echo Plugin directory created
)

if not exist "%PLUGIN_DIR%" (
    mkdir "%PLUGIN_DIR%"
    echo Math Study Dashboard directory created
)

echo [2/3] Copying files...

REM Copy manifest.json
if exist "manifest.json" (
    copy "manifest.json" "%PLUGIN_DIR%\" >nul
    echo ✓ manifest.json copied
) else (
    echo Creating basic manifest.json...
    (
        echo {
        echo   "id": "math-study-dashboard",
        echo   "name": "Math Study Dashboard",
        echo   "version": "1.0.0",
        echo   "minAppVersion": "0.15.0",
        echo   "description": "Math study progress dashboard",
        echo   "author": "Math Study Team"
        echo }
    ) > "%PLUGIN_DIR%\manifest.json"
    echo ✓ manifest.json created
)

REM Try different main files
if exist "main.js" (
    copy "main.js" "%PLUGIN_DIR%\" >nul
    echo ✓ main.js copied
) else if exist "main-simple.js" (
    copy "main-simple.js" "%PLUGIN_DIR%\main.js" >nul
    echo ✓ main-simple.js copied as main.js
) else (
    echo ❌ No main.js file found!
    echo Please run: npm run build first
    pause
    exit /b 1
)

echo [3/3] Installation complete!
echo.
echo Next steps:
echo 1. Restart Obsidian
echo 2. Go to Settings → Community plugins
echo 3. Enable "Math Study Dashboard"
echo 4. Look for the chart icon in the left ribbon
echo.
echo Installation location: %PLUGIN_DIR%
echo.
echo Files installed:
dir "%PLUGIN_DIR%" /b
echo.
pause