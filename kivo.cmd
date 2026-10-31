@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20+ is required. Install it and try again.
  exit /b 1
)
set "KIVO_PROJECT=%USERPROFILE%\Documents\KivoProjects"
if exist "%USERPROFILE%\Documents\ProjectMateProjects" set "KIVO_PROJECT=%USERPROFILE%\Documents\ProjectMateProjects"
if not exist "%KIVO_PROJECT%" mkdir "%KIVO_PROJECT%"
node "%~dp0scripts\projectmate-kimi-local.mjs" %* --project "%KIVO_PROJECT%" --speed turbo
