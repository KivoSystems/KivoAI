# Legacy compatibility launcher.
& (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "kivo.ps1") @args
exit $LASTEXITCODE
