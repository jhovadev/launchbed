param(
    [Parameter(Position = 0)]
    [string]$Action = "mirror",
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Rest = @()
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "..")

function Show-ScrcpyInstall {
    Write-Host "scrcpy is not installed." -ForegroundColor Red
    Write-Host "Install a current build (distribution packages are often obsolete):"
    Write-Host "  mise use -g github:Genymobile/scrcpy@5.0.1"
    Write-Host "  # or add the Launchbed addon tooling/scrcpy, then: mise install"
    Write-Host "  Windows: winget install Genymobile.scrcpy   (or the official zip)"
    Write-Host "  macOS:  brew install scrcpy"
    Write-Host "  Linux:  official tarball from https://github.com/Genymobile/scrcpy/releases"
    Write-Host "Docs: https://github.com/Genymobile/scrcpy"
    Write-Host "This project never downloads or redistributes scrcpy at generate time."
}

function Test-SafeRelPath([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    if ($Path.Contains("..")) { return $false }
    if ($Path.StartsWith("/") -or $Path.StartsWith("\") -or $Path.StartsWith("~")) { return $false }
    if ($Path -match '^[A-Za-z]:') { return $false }
    return $Path -match '^[A-Za-z0-9._/\-\\]+$'
}

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
    Write-Error "adb is not available. Run: just sdk-setup"
    exit 2
}

if ($Action.StartsWith("-")) {
    $Rest = @($Action) + $Rest
    $Action = "mirror"
}

$serial = & (Join-Path $scriptDir "device.ps1") serial
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Action -in @("mirror", "mirror-wifi", "record")) {
    if (-not (Get-Command scrcpy -ErrorAction SilentlyContinue)) {
        Show-ScrcpyInstall
        exit 2
    }
}

switch ($Action) {
    "mirror" {
        & scrcpy --serial $serial --stay-awake @Rest
        exit $LASTEXITCODE
    }
    "mirror-wifi" {
        & scrcpy --serial $serial --tcpip --stay-awake @Rest
        exit $LASTEXITCODE
    }
    "record" {
        $file = "capture.mp4"
        $flags = @()
        if ($Rest.Count -gt 0 -and -not $Rest[0].StartsWith("-")) {
            $file = $Rest[0]
            if ($Rest.Count -gt 1) { $flags = $Rest[1..($Rest.Count - 1)] }
        } else {
            $flags = $Rest
        }
        if (-not (Test-SafeRelPath $file)) {
            Write-Error "Refusing record path '$file'. Use a relative path with letters, digits, '.', '_', '-' or '/' only."
            exit 2
        }
        $dir = Split-Path -Parent $file
        if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        & scrcpy --serial $serial --record=$file --no-audio @flags
        exit $LASTEXITCODE
    }
    default {
        Write-Error "Usage: .\scripts\scrcpy.ps1 [mirror|mirror-wifi|record [file]]  (extra official scrcpy flags are forwarded)"
        exit 2
    }
}
