param(
    [Parameter(Position = 0)]
    [string]$Action = "devices",
    [Parameter(Position = 1)]
    [string]$Argument = ""
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "..")

function Test-SafeRelPath([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    if ($Path.Contains("..")) { return $false }
    if ($Path.StartsWith("/") -or $Path.StartsWith("\") -or $Path.StartsWith("~")) { return $false }
    if ($Path -match '^[A-Za-z]:') { return $false }
    return $Path -match '^[A-Za-z0-9._/\-\\]+$'
}

function Test-SafeUri([string]$Uri) {
    if ([string]::IsNullOrWhiteSpace($Uri)) { return $false }
    if ($Uri -match "[\r\n;|`$`]") { return $false }
    return $Uri -match '^[A-Za-z][A-Za-z0-9+.-]*:'
}

function Select-Serial {
    $listing = @(& adb devices -l)
    if ($LASTEXITCODE -ne 0) { Write-Error "adb devices failed"; exit 2 }
    $devices = @()
    $states = @{}
    foreach ($line in $listing) {
        if ($line -match "^(\S+)\s+(device|offline|unauthorized|recovery|sideload)\b") {
            $states[$Matches[1]] = $Matches[2]
            if ($Matches[2] -eq 'device') { $devices += $Matches[1] }
        }
    }
    if ($env:ANDROID_SERIAL) {
        if ($env:ANDROID_SERIAL -notmatch '^[A-Za-z0-9._:-]+$') { Write-Error "Invalid ANDROID_SERIAL"; exit 2 }
        if (-not $states.ContainsKey($env:ANDROID_SERIAL) -or $states[$env:ANDROID_SERIAL] -ne 'device') {
            Write-Error "ANDROID_SERIAL is not an authorized online device. Check adb devices -l"
            exit 2
        }
        return $env:ANDROID_SERIAL
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
    { $_ -in @("logs", "logcat") } {
        $serial = Select-Serial
        $appPid = (& adb -s $serial shell pidof -s "{{applicationId}}").Trim()
        if (-not $appPid) {
            Write-Error "The app is not running on $serial. Start it with: just run"
            exit 4
        }
        Write-Host "Streaming logcat for {{applicationId}} (pid $appPid). Press Ctrl+C to stop."
        & adb -s $serial logcat -v brief --pid $appPid
    }
    "screenshot" {
        $file = if ($Argument) { $Argument } else { "screenshot.png" }
        if (-not (Test-SafeRelPath $file)) {
            Write-Error "Refusing screenshot path '$file'. Use a relative path with letters, digits, '.', '_', '-' or '/' only."
            exit 2
        }
        $serial = Select-Serial
        $dir = Split-Path -Parent $file
        if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        & adb -s $serial exec-out screencap -p | Set-Content -Path $file -Encoding Byte
        Write-Host "Wrote $file"
        exit $LASTEXITCODE
    }
    "clear-data" {
        $serial = Select-Serial
        & adb -s $serial shell pm clear "{{applicationId}}"
        exit $LASTEXITCODE
    }
    "uninstall" {
        $serial = Select-Serial
        & adb -s $serial uninstall "{{applicationId}}"
        exit $LASTEXITCODE
    }
    "deeplink" {
        if (-not (Test-SafeUri $Argument)) {
            Write-Error "Refusing deeplink '$Argument'. Pass a URI such as https://example.com/path or myapp://host."
            exit 2
        }
        $serial = Select-Serial
        & adb -s $serial shell am start -a android.intent.action.VIEW -d $Argument
        exit $LASTEXITCODE
    }
    default {
        Write-Error "Usage: .\scripts\device.ps1 [devices|serial|install|launch|run|logs|screenshot|clear-data|uninstall|deeplink]"
        exit 2
    }
}
