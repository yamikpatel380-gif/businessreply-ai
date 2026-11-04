@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title BusinessReply AI - Start

echo ==================================================
echo BusinessReply AI - WhatsApp QR / Gmail / Multiple AI Providers
echo ==================================================

where node.exe >nul 2>nul
if errorlevel 1 goto no_node
where npm.cmd >nul 2>nul
if errorlevel 1 goto no_npm
if not exist ".env" copy ".env.example" ".env" >nul

echo [1/3] Checking installed dependencies...
node CHECK_MODULES.mjs
if not errorlevel 1 goto launch

echo.
echo Dependencies are missing or incomplete.
where git.exe >nul 2>nul
if errorlevel 1 goto no_git

echo [2/3] Installing dependencies with npm...
call npm.cmd install
if errorlevel 1 goto install_failed

echo [3/3] Verifying all packages can actually load...
node CHECK_MODULES.mjs
if errorlevel 1 goto install_failed

goto launch

:launch
echo.
echo Dependencies verified. Starting the server...
echo Do not share the private dashboard launch link.
echo WhatsApp auto-reply remains OFF until manually enabled.
node server.mjs
if errorlevel 1 (
 echo.
 echo Server stopped with an error. Review the lines above.
)
pause
exit /b 0

:no_git
echo.
echo ERROR: Git is not available on PATH.
echo Baileys needs Git to install one of its dependencies.
echo 1. Install Git for Windows from https://git-scm.com/downloads/win
echo 2. Choose the option to use Git from the command line.
echo 3. Close ALL old PowerShell/CMD windows.
echo 4. Open a new terminal and run: git --version
echo 5. Double-click START_WINDOWS.bat again.
echo.
pause
exit /b 1

:no_node
echo ERROR: Node.js is not installed or missing from PATH.
pause
exit /b 1

:no_npm
echo ERROR: npm.cmd was not found. Reinstall a stable Node.js release.
pause
exit /b 1

:install_failed
echo.
echo ERROR: npm dependencies were NOT installed completely.
echo The server will NOT be started with missing packages.
echo Check the npm error shown above. Do not use npm audit fix --force.
echo.
pause
exit /b 1
