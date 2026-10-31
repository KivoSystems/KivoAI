# Kivo Windows launcher (PowerShell). Existing ProjectMate data remains accessible.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$legacyProject = Join-Path $HOME 'Documents\ProjectMateProjects'
$defaultProject = if (Test-Path $legacyProject) { $legacyProject } else { Join-Path $HOME 'Documents\KivoProjects' }
if (-not (Test-Path $defaultProject)) { New-Item -ItemType Directory -Path $defaultProject -Force | Out-Null }
& node (Join-Path $root 'scripts\projectmate-kimi-local.mjs') @args --project $defaultProject --speed turbo
exit $LASTEXITCODE
