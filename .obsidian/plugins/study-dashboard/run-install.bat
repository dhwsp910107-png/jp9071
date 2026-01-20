@echo off
title Math Study Dashboard - PowerShell Installer

echo.
echo ===================================================
echo     Math Study Dashboard - PowerShell Installer
echo ===================================================
echo.

echo Starting PowerShell installation script...
echo.

REM Execute PowerShell script with proper execution policy
powershell.exe -ExecutionPolicy Bypass -File "%~dp0install.ps1"

echo.
echo Installation script completed.
pause