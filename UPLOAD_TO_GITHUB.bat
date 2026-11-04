@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title BusinessReply AI - GitHub upload

echo =====================================================
echo   BUSINESSREPLY AI - UPLOAD TO GITHUB
echo   Target: yamikpatel380-gif/businessreply-ai
echo =====================================================
echo.
if not exist "package.json" (
  echo ERROR: Run this BAT inside the extracted businessreply-ai folder.
  pause
  exit /b 1
)
where git >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git for Windows not found.
  echo Install Git, then reopen this file.
  pause
  exit /b 1
)

echo Checking for private files...
for %%F in (.env credentials.json .gmail_token.json .local_admin_token .local_state.json) do (
 if exist "%%F" (
  echo ERROR: Private file %%F found in this folder.
  echo Please use the CLEAN ZIP and do not upload personal credentials.
  pause
  exit /b 1
 )
)
if exist ".baileys_auth" (
echo ERROR: WhatsApp session directory found. Do NOT upload it.
 pause
 exit /b 1
)
if exist "node_modules" (
echo ERROR: node_modules found. Use a fresh extracted GitHub-ready ZIP.
 pause
 exit /b 1
)

if not exist ".git" (
 git init -b main
 if errorlevel 1 goto :failed
)

set "REPO=https://github.com/yamikpatel380-gif/businessreply-ai.git"
git remote get-url origin >nul 2>&1
if errorlevel 1 (
 git remote add origin "%REPO%"
 if errorlevel 1 goto :failed
) else (
 for /f "usebackq delims=" %%U in (`git remote get-url origin`) do set "CURRENT_REMOTE=%%U"
 if /i not "!CURRENT_REMOTE!"=="%REPO%" (
  echo ERROR: This folder points to a DIFFERENT GitHub repository:
  echo !CURRENT_REMOTE!
  echo No remote has been changed. Please use a clean extracted ZIP.
  pause
  exit /b 1
 )
)

for /f "delims=" %%V in ('git config user.name 2^>nul') do set "GIT_NAME=%%V"
if not defined GIT_NAME git config user.name "yamikpatel380-gif"
for /f "delims=" %%V in ('git config user.email 2^>nul') do set "GIT_EMAIL=%%V"
if not defined GIT_EMAIL git config user.email "yamikpatel380-gif@users.noreply.github.com"

git add -A
if errorlevel 1 goto :failed

REM A hard safety barrier if hidden credentials accidentally become tracked.
for %%F in (.env credentials.json .gmail_token.json .local_admin_token .local_state.json) do (
 git ls-files --error-unmatch "%%F" >nul 2>&1
 if not errorlevel 1 (
  echo ERROR: Sensitive file %%F was staged. Upload cancelled.
  git reset -- "%%F" >nul 2>&1
  pause
  exit /b 1
 )
)

git diff --cached --quiet
if errorlevel 1 (
 git commit -m "Add BusinessReply AI premium dashboard and setup guide"
 if errorlevel 1 goto :failed
) else (
echo There are no new files to commit.
)

echo.
echo Uploading source files to GitHub...
echo A GitHub login window may open. Sign in ONLY to GitHub.
git push -u origin HEAD:main
if errorlevel 1 goto :failed

echo.
echo SUCCESS! Your GitHub repository is updated.
echo https://github.com/yamikpatel380-gif/businessreply-ai
start "" "https://github.com/yamikpatel380-gif/businessreply-ai"
pause
exit /b 0

:failed
echo.
echo UPLOAD FAILED. Nothing was force-pushed or deleted.
echo Copy only the last Git error (do not share tokens) for troubleshooting.
pause
exit /b 1
