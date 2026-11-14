$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "..")

if (-not (Get-Command scrcpy -ErrorAction SilentlyContinue)) {
    Write-Host "scrcpy is not installed." -ForegroundColor Red
    Write-Host "Install it from your package manager or from https://github.com/Genymobile/scrcpy"
    Write-Host "This project never downloads or redistributes scrcpy."
    exit 2
}

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
    Write-Error "adb is not available. Run: just sdk-setup"
}

$serial = & (Join-Path $scriptDir "device.ps1") serial
& scrcpy --serial $serial @args
exit $LASTEXITCODE
