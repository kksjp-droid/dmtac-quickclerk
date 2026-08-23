@echo off
REM ---------------------------------------------------------------------
REM DMTAC QuickClerk - one-command publish to GitHub Pages (Windows)
REM
REM Double-click this file, or run from a terminal in this folder:
REM     publish.bat "your commit message"
REM
REM First run  : creates the repo (needs GitHub CLI), pushes, enables Pages.
REM Later runs : commits changes and pushes.
REM
REM It never handles your password or token - it uses whatever git / gh
REM authentication you already have. If you have never authenticated,
REM run  gh auth login  once first.
REM ---------------------------------------------------------------------
setlocal enabledelayedexpansion

set "REPO_NAME=dmtac-quickclerk"
set "BRANCH=main"
set "MSG=%~1"
if "%MSG%"=="" set "MSG=Update DMTAC QuickClerk"

cd /d "%~dp0"

echo.
echo ==^> Checking required files
for %%F in (index.html script.js style.css) do (
  if not exist "%%F" (
    echo !!  %%F not found - run this from the DMTAC_CCMS_Clerking_Helper folder.
    pause & exit /b 1
  )
)
echo     ok

echo.
echo ==^> Scanning for accidentally committed API keys
findstr /R /S /C:"AIza[0-9A-Za-z_-][0-9A-Za-z_-]*" /C:"sk-[A-Za-z0-9][A-Za-z0-9]*" *.js *.html *.json *.md >nul 2>&1
if %errorlevel%==0 (
  echo !!  Something that looks like an API key was found. Remove it before publishing:
  findstr /R /S /N /C:"AIza[0-9A-Za-z_-][0-9A-Za-z_-]*" /C:"sk-[A-Za-z0-9][A-Za-z0-9]*" *.js *.html *.json *.md
  pause & exit /b 1
)
echo     none found.

where git >nul 2>&1 || (echo !!  git is not installed - get it from https://git-scm.com & pause & exit /b 1)

if not exist ".git" (
  echo.
  echo ==^> Initialising git repository
  git init -q
)
git checkout -q -B %BRANCH%
git add -A
git diff --cached --quiet
if %errorlevel%==0 (
  echo.
  echo ==^> No changes to commit - nothing to publish.
  pause & exit /b 0
)
git commit -q -m "%MSG%"
echo     committed: %MSG%

git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
  where gh >nul 2>&1
  if !errorlevel! neq 0 (
    echo.
    echo !!  No 'origin' remote and GitHub CLI is not installed.
    echo     Install it from https://cli.github.com and re-run, or create an
    echo     empty repo on github.com then run:
    echo         git remote add origin https://github.com/YOUR-USERNAME/%REPO_NAME%.git
    echo         git push -u origin %BRANCH%
    pause & exit /b 1
  )
  echo.
  echo ==^> Creating GitHub repository '%REPO_NAME%' ^(public^)
  gh repo create %REPO_NAME% --public --source=. --remote=origin --push
  echo.
  echo ==^> Enabling GitHub Pages
  gh api -X POST "repos/{owner}/%REPO_NAME%/pages" -f "source[branch]=%BRANCH%" -f "source[path]=/" >nul 2>&1
  if !errorlevel! neq 0 echo     Pages may already be enabled, or enable it under Settings ^> Pages.
  for /f "delims=" %%U in ('gh api user -q .login') do set "GHUSER=%%U"
  echo.
  echo ==^> Published. Your site ^(allow a minute or two to build^):
  echo     https://!GHUSER!.github.io/%REPO_NAME%/
  echo.
  echo     Next: put that URL into ALLOWED_ORIGINS in kksj-ai-proxy-worker.js
  echo           and redeploy the Worker, so only your site can call it.
  pause & exit /b 0
)

echo.
echo ==^> Pushing to origin/%BRANCH%
git push -u origin %BRANCH%
echo.
echo ==^> Done. GitHub Pages will rebuild in a minute or two.
pause
