param(
    [Parameter(Position = 0)]
    [string]$Action = "devices"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "..")

function Select-Serial {
    if ($env:ANDROID_SERIAL) { return $env:ANDROID_SERIAL }

    $devices = @()
    foreach ($line in (& adb devices)) {
        if ($line -match "^(\S+)\s+device\b") { $devices += $Matches[1] }
    }

    if ($devices.Count -eq 0) {
        Write-Error "No authorized Android device found. Connect a device with USB debugging enabled, or start an emulator."
        exit 2
    }
    if ($devices.Count -eq 1) { return $devices[0] }

    Write-Host "Multiple devices detected:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $devices.Count; $i++) {
        Write-Host "  $($i + 1)) $($devices[$i])"
    }
    Write-Host "Tip: set ANDROID_SERIAL to skip this prompt."
    $choice = Read-Host "Select device [1-$($devices.Count)]"
    $index = 0
    if (-not [int]::TryParse($choice, [ref]$index)) { Write-Error "Invalid selection."; exit 3 }
    if ($index -lt 1 -or $index -gt $devices.Count) { Write-Error "Invalid selection."; exit 3 }
    return $devices[$index - 1]
}

switch ($Action) {
    "devices" {
        & adb devices -l
    }
    "serial" {
        Select-Serial
    }
    "install" {
        $serial = Select-Serial
        $env:ANDROID_SERIAL = $serial
        & .\gradlew.bat :app:installDebug
        exit $LASTEXITCODE
    }
    "launch" {
        $serial = Select-Serial
        & adb -s $serial shell am start -n "{{applicationId}}/{{packageName}}.MainActivity"
        exit $LASTEXITCODE
    }
    "run" {
        & .\gradlew.bat :app:assembleDebug
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        $serial = Select-Serial
        $env:ANDROID_SERIAL = $serial
        & .\gradlew.bat :app:installDebug
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        & adb -s $serial shell am start -n "{{applicationId}}/{{packageName}}.MainActivity"
        exit $LASTEXITCODE
    }
    "logs" {
        $serial = Select-Serial
        $appPid = (& adb -s $serial shell pidof -s "{{applicationId}}").Trim()
        if (-not $appPid) {
            Write-Error "The app is not running on $serial. Start it with: just run"
            exit 4
        }
        Write-Host "Streaming logcat for {{applicationId}} (pid $appPid). Press Ctrl+C to stop."
        & adb -s $serial logcat -v brief --pid $appPid
    }
    default {
        Write-Error "Usage: .\scripts\device.ps1 [devices|serial|install|launch|run|logs]"
        exit 2
    }
}
