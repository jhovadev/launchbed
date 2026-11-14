param(
    [switch]$Install,
    [switch]$AcceptLicenses
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "..")

if ($env:INSTALL -eq "1") { $Install = $true }

$sdkRoot = $env:ANDROID_HOME
if (-not $sdkRoot) { $sdkRoot = $env:ANDROID_SDK_ROOT }
if (-not $sdkRoot) { $sdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk" }

$platformPackage = "{{compileSdkPackage}}"
$buildTools = "{{buildToolsVersion}}"

Write-Host "Android SDK setup"
Write-Host "  SDK root: $sdkRoot"
Write-Host "  Platform: android-$platformPackage"
Write-Host "  Build tools: $buildTools"
Write-Host ""

$androidCli = Join-Path $sdkRoot "cmdline-tools\latest\bin\android.bat"
$sdkManager = Join-Path $sdkRoot "cmdline-tools\latest\bin\sdkmanager.bat"
$cliKind = "none"
if (Test-Path $androidCli) { $cliKind = "android" }
elseif (Test-Path $sdkManager) { $cliKind = "sdkmanager" }

$missing = @()
foreach ($package in @("platform-tools", "platforms/android-$platformPackage", "build-tools/$buildTools")) {
    $path = Join-Path $sdkRoot ($package -replace "/", "\")
    if (Test-Path $path) {
        Write-Host "  [installed] $package"
    } else {
        Write-Host "  [missing]   $package"
        $missing += $package
    }
}

if (Test-Path (Join-Path $sdkRoot "licenses\android-sdk-license")) {
    Write-Host "  [ok]        Android SDK license accepted"
} else {
    Write-Host "  [attention] Android SDK license not accepted"
}

if ($cliKind -eq "none") {
    Write-Host ""
    Write-Host "Android command-line tools are not installed."
    Write-Host "Download the official command-line tools from:"
    Write-Host "  https://developer.android.com/studio#command-tools"
    Write-Host "Unzip them so that this file exists:"
    Write-Host "  $sdkManager"
    exit 2
}

if ($missing.Count -eq 0) {
    Write-Host ""
    Write-Host "All required SDK packages are installed."
} else {
    Write-Host ""
    Write-Host "Install plan (nothing has been changed yet):"
    foreach ($package in $missing) { Write-Host "  - $package" }

    if (-not $Install) {
        Write-Host ""
        Write-Host "Dry run only. To install:"
        Write-Host "  .\scripts\sdk-setup.ps1 -Install"
        Write-Host ""
        Write-Host "If Gradle reports unaccepted licenses, run once:"
        Write-Host "  $sdkManager --licenses"
        exit 0
    }

    New-Item -ItemType Directory -Force -Path $sdkRoot | Out-Null
    if ($cliKind -eq "android") {
        foreach ($package in $missing) {
            & $androidCli sdk install $package
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
    } else {
        if ($AcceptLicenses) {
            Write-Host "Accepting Android SDK licenses..."
            "y" | & $sdkManager --licenses
        }
        $semicolonPackages = $missing | ForEach-Object { $_ -replace "/", ";" }
        & $sdkManager --install $semicolonPackages
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
}

if ($Install) {
    "sdk.dir=$($sdkRoot -replace '\\', '/')" | Set-Content -Encoding ascii -Path local.properties
    Write-Host ""
    Write-Host "Wrote local.properties (git-ignored) and finished SDK setup."
} else {
    Write-Host ""
    Write-Host "Dry run complete; nothing was changed and local.properties was not written."
}
