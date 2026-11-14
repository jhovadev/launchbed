# Read-only environment diagnostics for Windows PowerShell.
$ErrorActionPreference = "Continue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "..")

$status = 0
function Ok($message) { Write-Host "  [ok]      $message" }
function Warn($message) { Write-Host "  [warning] $message" }
function Missing($message) { Write-Host "  [missing] $message"; $script:status = 1 }

Write-Host "Android Initializr project doctor"
Write-Host "OS: Windows $([System.Environment]::OSVersion.Version)"
Write-Host ""

$java = Get-Command java -ErrorAction SilentlyContinue
if ($java) {
    Ok "java: $((& java -version 2>&1 | Select-Object -First 1))"
} else {
    Missing "java not found. Install JDK 21 (mise install) and retry."
}

if ($env:JAVA_HOME) { Ok "JAVA_HOME=$env:JAVA_HOME" } else { Warn "JAVA_HOME is not set; Gradle will use java from PATH." }

$sdkRoot = $env:ANDROID_HOME
if (-not $sdkRoot) { $sdkRoot = $env:ANDROID_SDK_ROOT }
if (-not $sdkRoot) {
    $candidate = Join-Path $env:LOCALAPPDATA "Android\Sdk"
    if (Test-Path $candidate) { $sdkRoot = $candidate }
}

if ($sdkRoot -and (Test-Path $sdkRoot)) {
    Ok "Android SDK: $sdkRoot"
    if (Test-Path (Join-Path $sdkRoot "platforms\android-{{compileSdkPackage}}")) {
        Ok "platform android-{{compileSdkPackage}} installed"
    } else {
        Missing "platform android-{{compileSdkPackage}} missing (just sdk-setup)"
    }
    if (Test-Path (Join-Path $sdkRoot "build-tools\{{buildToolsVersion}}")) {
        Ok "build-tools {{buildToolsVersion}} installed"
    } else {
        Missing "build-tools {{buildToolsVersion}} missing (just sdk-setup)"
    }
    if (Test-Path (Join-Path $sdkRoot "licenses\android-sdk-license")) {
        Ok "Android SDK license accepted"
    } else {
        Warn "Android SDK license not found; sdk-setup will explain how to accept it."
    }
} else {
    Missing "Android SDK not found. Set ANDROID_HOME or run just sdk-setup."
}

$adb = Get-Command adb -ErrorAction SilentlyContinue
if ($adb) {
    Ok "adb: $((& adb version 2>$null | Select-Object -First 1))"
    $deviceCount = @(& adb devices 2>$null | Select-Object -Skip 1 | Where-Object { $_ -match "\sdevice$" }).Count
    Ok "authorized devices: $deviceCount"
} else {
    Missing "adb not found. Install platform-tools (just sdk-setup)."
}

if (Test-Path ".\gradlew.bat") { Ok "Gradle wrapper present ({{gradleVersion}})" } else { Warn "gradlew.bat is missing." }

$scrcpy = Get-Command scrcpy -ErrorAction SilentlyContinue
if ($scrcpy) { Ok "scrcpy is available" } else { Warn "scrcpy is not installed (optional; just scrcpy needs it)." }

Write-Host ""
if ($status -eq 0) {
    Write-Host "Doctor result: ready to build."
} else {
    Write-Host "Doctor result: missing required tools. Fix the [missing] entries above."
}
exit $status
