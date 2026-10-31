@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
title KivoAI - Windows Setup

rem KivoAI Windows installer / guided setup (v0.8.0).
rem Uses Windows Package Manager (winget) and the Ollama CLI.
rem Never downloads or executes a remote script, deletes models, or replaces memory.

set "CHAT_MODEL=hf.co/mradermacher/Kimi-VL-A3B-Instruct-GGUF:Q2_K"
set "CODING_MODEL=qwen2.5-coder:7b"
set "SMART_MODEL=qwen3.5:4b"
set "NODE_OK=0"
set "OLLAMA_OK=0"
set "CHAT_OK=0"
set "CODE_OK=0"
set "SMART_OK=0"

cls
echo.
echo    ===================================================
echo                  KivoAI  ^|  SETUP WIZARD
echo    ===================================================
echo.
echo    Your local AI developer companion.
echo.
echo    This installer can set up:
echo      - Node.js 22+  (required)
echo      - Ollama       (required)
echo      - Kimi Q2      (chat model, approx. 6.6 GB)
echo      - Qwen Coder 7B (optional, approx. 4.7 GB)
echo      - Qwen3.5 4B (optional smart chat, approx. 3.4 GB)
echo      - Python / Pygame (optional coding extras)
echo.
echo    It uses official winget packages and Ollama's model registry.
echo    It will ask before installing software or downloading models.
echo    Some installations may request Windows administrator approval.
echo    Existing models, project files, and memories are not deleted.
echo.

if exist "%~dp0kivo.cmd" goto projectFound
echo [ERROR] Could not find kivo.cmd next to installer.bat.
echo.
echo Download and extract the full KivoAI Windows release or GitHub ZIP.
echo Put installer.bat inside the extracted Kivo-Windows folder,
echo next to kivo.cmd, and run it again.
echo.
echo Repository: https://github.com/Bleh-12345/KivoAI
pause
exit /b 1

:projectFound
choice /C YN /N /M "Start Kivo setup? [Y/N]: "
if errorlevel 2 exit /b 0

echo.
echo [1/5] Checking Node.js...
call :checkNode
if errorlevel 1 goto setupIncomplete

echo.
echo [2/5] Checking Ollama...
call :checkOllama
if errorlevel 1 goto setupIncomplete

echo.
echo [3/5] Checking local Ollama server...
call :checkServer
if errorlevel 1 goto setupIncomplete

echo.
echo [4/5] Setting up your AI models...
call :chatModel
if errorlevel 1 goto setupIncomplete
call :codingModel
call :smartModel

echo.
echo [5/5] Optional Python tools...
call rem Qwen3.5 4B is an optional stronger chat/planning model. It is never pulled silently.
:smartModel
ollama show "%SMART_MODEL%" >nul 2>&1
if not errorlevel 1 (
  echo Optional Qwen3.5 smart model is already installed.
  set "SMART_OK=1"
  exit /b 0
)
echo.
echo OPTIONAL: Qwen3.5 4B improves complex questions and agent planning.
echo The additional download is approximately 3.4 GB plus overhead.
echo Kivo automatically discovers this model on its next launch.
choice /C YN /N /M "Download Qwen3.5 4B smart model? [Y/N]: "
if errorlevel 2 exit /b 0
ollama pull "%SMART_MODEL%"
if errorlevel 1 (
  echo The optional smart-model download failed. Kivo still works.
  exit /b 0
)
ollama show "%SMART_MODEL%" >nul 2>&1
if errorlevel 1 (
  echo Could not verify optional smart model. Kivo still works.
  exit /b 0
)
set "SMART_OK=1"
exit /b 0

:pythonExtras

echo.
echo    ===================================================
echo                    SETUP COMPLETE
echo    ===================================================
echo.
echo KivoAI files: %~dp0
echo Chat model:  %CHAT_MODEL%
if "%CODE_OK%"=="1" echo Optional coding model available: %CODING_MODEL%
if not "%CODE_OK%"=="1" echo Optional coding model not downloaded by this setup
if "%SMART_OK%"=="1" echo Optional smart reasoning model available: %SMART_MODEL%

echo.
echo TO START KIVO:
echo    1. Keep Ollama running in the background.
echo    2. Open this folder and run kivo.cmd.
echo    3. Or open Command Prompt here and run:
echo.
echo       kivo.cmd --model %CHAT_MODEL% --speed balanced

echo.
echo Once Kivo opens, try /help, /version, /memory and /code.
echo For coding: /coding-model %CODING_MODEL%
echo For smarter responses: /smart on   ^&   /smart model %SMART_MODEL%
echo To use project files: /review followed by /code [your task].
echo.
echo Your existing data stays in %%USERPROFILE%%\.projectmate-kimi.
echo Full setup and troubleshooting: INSTALLATION.md

echo.
choice /C YN /N /M "Launch Kivo now? [Y/N]: "
if errorlevel 2 goto finished
call "%~dp0kivo.cmd" --model "%CHAT_MODEL%" --speed balanced

:finished
echo.
echo Enjoy building with KivoAI!
pause
exit /b 0

:setupIncomplete
echo.
echo    ===================================================
echo                    SETUP INCOMPLETE
echo    ===================================================
echo.
echo Please follow the fix above, then run installer.bat again.
echo It is safe to rerun. Already-installed tools and models are reused.
echo Troubleshooting: INSTALLATION.md
echo.
pause
exit /b 1

:checkNode
rem Resolve an existing Node installation from PATH first, then its typical directory.
where node.exe >nul 2>&1
if not errorlevel 1 goto nodeVersion
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node.exe >nul 2>&1
if not errorlevel 1 goto nodeVersion
echo Node.js was not found.
call :installWinget "OpenJS.NodeJS.LTS" "Node.js LTS"
if errorlevel 1 exit /b 1
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node.exe >nul 2>&1
if errorlevel 1 goto nodeRestart

:nodeVersion
set "NODE_MAJOR="
for /f "delims=" %%N in ('node -p "process.versions.node.split('.')[0]" 2^>nul') do set "NODE_MAJOR=%%N"
if not defined NODE_MAJOR goto nodeRestart
if %NODE_MAJOR% GEQ 22 goto nodeReady
echo Found Node.js major version %NODE_MAJOR%; Kivo needs version 22 or newer.
echo Update Node.js LTS from https://nodejs.org/ or using winget upgrade.
echo.
choice /C YN /N /M "Try upgrading Node.js LTS with winget? [Y/N]: "
if errorlevel 2 exit /b 1
where winget.exe >nul 2>&1
if errorlevel 1 goto wingetMissing
winget upgrade --id OpenJS.NodeJS.LTS --exact --source winget --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo Upgrade did not complete. Try the official Node.js installer.
  exit /b 1
)
echo If the previous Node version is still in PATH, close this window,
echo open a new Command Prompt, and rerun installer.bat.
exit /b 1

:nodeReady
node --version
set "NODE_OK=1"
exit /b 0

:nodeRestart
echo Node.js may have installed, but this terminal cannot find it yet.
echo Close all Command Prompt windows, open a new one, and rerun installer.bat.
echo You can check with: node --version
exit /b 1

:checkOllama
where ollama.exe >nul 2>&1
if not errorlevel 1 goto ollamaReady
if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "PATH=%LOCALAPPDATA%\Programs\Ollama;%PATH%"
if exist "%ProgramFiles%\Ollama\ollama.exe" set "PATH=%ProgramFiles%\Ollama;%PATH%"
where ollama.exe >nul 2>&1
if not errorlevel 1 goto ollamaReady
echo Ollama was not found.
call :installWinget "Ollama.Ollama" "Ollama"
if errorlevel 1 exit /b 1
if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "PATH=%LOCALAPPDATA%\Programs\Ollama;%PATH%"
if exist "%ProgramFiles%\Ollama\ollama.exe" set "PATH=%ProgramFiles%\Ollama;%PATH%"
where ollama.exe >nul 2>&1
if errorlevel 1 (
  echo Ollama may have installed, but this terminal cannot find it yet.
  echo Close this window, open a fresh terminal, and rerun installer.bat.
  echo Official manual installer: https://ollama.com/download/windows
  exit /b 1
)

:ollamaReady
ollama --version
set "OLLAMA_OK=1"
exit /b 0

:checkServer
call :probeOllama
if not errorlevel 1 (
  echo Ollama is already running at http://127.0.0.1:11434
  exit /b 0
)
echo Ollama is installed but its local server is not responding.
echo You can also open Ollama from the Windows Start menu.
choice /C YN /N /M "Start Ollama locally now? [Y/N]: "
if errorlevel 2 exit /b 1
start "KivoAI Ollama server" /min cmd /c "ollama serve"
echo Starting local server; checking connection...
timeout /t 6 /nobreak >nul
call :probeOllama
if not errorlevel 1 (
  echo Ollama server is responding.
  exit /b 0
)
echo Could not reach Ollama. Try opening the Ollama app manually,
echo then rerun installer.bat. If another server uses port 11434,
echo fix that conflict before continuing.
exit /b 1

:probeOllama
powershell.exe -NoProfile -NonInteractive -Command "try { $null = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1
exit /b %errorlevel%

:chatModel
ollama show "%CHAT_MODEL%" >nul 2>&1
if not errorlevel 1 (
  echo The Kimi chat model is already installed; no download needed.
  set "CHAT_OK=1"
  exit /b 0
)
echo.
echo Kivo requires a local chat model. Recommended for 8 GB GPUs:
echo    %CHAT_MODEL%
echo Approximate model download: 6.6 GB (plus installation/storage overhead).
echo This is a significant download and may take time.
echo.
choice /C YN /N /M "Download the Kimi Q2 chat model now? [Y/N]: "
if errorlevel 2 (
  echo Skipped. Kivo cannot start until you install a model.
  echo Later run: ollama pull %CHAT_MODEL%
  exit /b 1
)
ollama pull "%CHAT_MODEL%"
if errorlevel 1 (
  echo Model download failed. Check your internet connection and free disk space.
  echo Retry later using: ollama pull %CHAT_MODEL%
  exit /b 1
)
ollama show "%CHAT_MODEL%" >nul 2>&1
if errorlevel 1 (
  echo Ollama did not confirm the chat model installation.
  exit /b 1
)
set "CHAT_OK=1"
echo Chat model installed successfully.
exit /b 0

:codingModel
echo.
ollama show "%CODING_MODEL%" >nul 2>&1
if not errorlevel 1 (
  echo Qwen coding model is already installed.
  set "CODE_OK=1"
  goto configureCoder
)
echo OPTIONAL: Qwen2.5-Coder 7B is often better for editing source code.
echo It is an additional download of approximately 4.7 GB.
choice /C YN /N /M "Download Qwen2.5-Coder 7B? [Y/N]: "
if errorlevel 2 (
  echo Skipping optional coding model.
  exit /b 0
)
ollama pull "%CODING_MODEL%"
if errorlevel 1 (
  echo Optional coding-model download failed. Kivo chat will still work.
  exit /b 0
)
ollama show "%CODING_MODEL%" >nul 2>&1
if errorlevel 1 (
  echo Could not verify the optional coding model.
  exit /b 0
)
set "CODE_OK=1"

:configureCoder
set "MEMORY_HOME=%KIVO_HOME%"
if not defined MEMORY_HOME set "MEMORY_HOME=%PROJECTMATE_KIMI_HOME%"
if not defined MEMORY_HOME set "MEMORY_HOME=%USERPROFILE%\.projectmate-kimi"
if exist "%MEMORY_HOME%\coding-model.txt" (
  echo Existing coding-model preference found; it will not be overwritten.
  echo In Kivo you can change it using: /coding-model %CODING_MODEL%
  exit /b 0
)
echo No coding-model preference exists yet.
choice /C YN /N /M "Set Qwen as Kivo's coding model? [Y/N]: "
if errorlevel 2 exit /b 0
if not exist "%MEMORY_HOME%" mkdir "%MEMORY_HOME%"
if not exist "%MEMORY_HOME%" (
  echo Cannot create the preferences folder. Configure in Kivo instead.
  exit /b 0
)
>"%MEMORY_HOME%\coding-model.txt" echo %CODING_MODEL%
echo Saved coding-model preference; existing memories are untouched.
exit /b 0

:pythonExtras
echo Optional Python is used for Python syntax checks and generated games.
where py.exe >nul 2>&1
if not errorlevel 1 goto pythonAvailable
where python.exe >nul 2>&1
if not errorlevel 1 goto pythonAvailable
choice /C YN /N /M "Install optional Python 3.13 with winget? [Y/N]: "
if errorlevel 2 (
  echo Python is optional; skipped.
  exit /b 0
)
call :installWinget "Python.Python.3.13" "Python 3.13"
if errorlevel 1 (
  echo Could not install optional Python. Kivo itself will still work.
  exit /b 0
)
where py.exe >nul 2>&1
if not errorlevel 1 goto pythonAvailable
where python.exe >nul 2>&1
if not errorlevel 1 goto pythonAvailable
echo Python may be installed; open a fresh terminal to use it.
exit /b 0

:pythonAvailable
choice /C YN /N /M "Install optional Pygame into your Python user environment? [Y/N]: "
if errorlevel 2 exit /b 0
where py.exe >nul 2>&1
if errorlevel 1 goto pythonViaPath
py -3 -m pip install --user pygame
if errorlevel 1 echo Pygame installation failed; Kivo itself still works.
exit /b 0
:pythonViaPath
python -m pip install --user pygame
if errorlevel 1 echo Pygame installation failed; Kivo itself still works.
exit /b 0

:installWinget
rem Each package install is explicitly confirmed. No remote script execution.
set "PACKAGE_ID=%~1"
set "PACKAGE_NAME=%~2"
where winget.exe >nul 2>&1
if errorlevel 1 goto wingetMissing
echo.
echo Package: %PACKAGE_NAME%
echo Source:  Windows Package Manager (winget)
echo ID:      %PACKAGE_ID%
choice /C YN /N /M "Install this package? [Y/N]: "
if errorlevel 2 exit /b 1
winget install --id "%PACKAGE_ID%" --exact --source winget --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo.
  echo winget could not install %PACKAGE_NAME%.
  echo Check its error above and try again from a new terminal.
  exit /b 1
)
exit /b 0

:wingetMissing
echo Windows Package Manager (winget) was not found.
echo Install or update App Installer from the Microsoft Store.
echo Or install the required programs manually from:
echo    Node.js: https://nodejs.org/
echo    Ollama:  https://ollama.com/download/windows
echo    Python:  https://www.python.org/downloads/windows/ (optional)
echo Then reopen a terminal and rerun installer.bat.
exit /b 1
