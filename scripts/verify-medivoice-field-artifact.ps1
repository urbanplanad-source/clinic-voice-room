param(
    [string]$ApkPath = "",
    [string]$DriveLetter = "Z:"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$gradleFile = Join-Path $repoRoot "android-staff-app\app\build.gradle.kts"
$gradleText = Get-Content -LiteralPath $gradleFile -Raw -Encoding UTF8
$versionName = [regex]::Match($gradleText, 'val appVersionName = "([^"]+)"').Groups[1].Value
$versionCode = [regex]::Match($gradleText, 'versionCode = (\d+)').Groups[1].Value

if (-not $versionName -or -not $versionCode) {
    throw "Could not read MediVoice version metadata from $gradleFile"
}

if (-not $ApkPath) {
    $ApkPath = Join-Path $repoRoot "android-staff-app\app\build\outputs\apk\field\medivoice-$versionName-field.apk"
}
$resolvedApk = (Resolve-Path -LiteralPath $ApkPath).Path
$createdMapping = $false
$toolApkPath = $resolvedApk

if ($resolvedApk.StartsWith($repoRoot, [StringComparison]::OrdinalIgnoreCase)) {
    if (Test-Path -LiteralPath "$DriveLetter\") {
        throw "$DriveLetter is already in use. Pass a different -DriveLetter value."
    }
    & subst.exe $DriveLetter $repoRoot
    if ($LASTEXITCODE -ne 0) { throw "Failed to map $DriveLetter to the repository." }
    $createdMapping = $true
    $relativeApk = $resolvedApk.Substring($repoRoot.Length).TrimStart('\')
    $toolApkPath = Join-Path "$DriveLetter\" $relativeApk
    $workspaceJava = "$DriveLetter\.tools\jdk-17\jdk-17.0.19+10"
    if (Test-Path -LiteralPath $workspaceJava) { $env:JAVA_HOME = $workspaceJava }
}

try {
$androidHome = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$buildToolsRoot = Join-Path $androidHome "build-tools"
$buildTools = Get-ChildItem -LiteralPath $buildToolsRoot -Directory |
    Sort-Object { [version]($_.Name -replace '-.*$', '') } -Descending |
    Select-Object -First 1
if (-not $buildTools) { throw "Android Build Tools not found: $buildToolsRoot" }

$aapt = Join-Path $buildTools.FullName "aapt.exe"
$apksigner = Join-Path $buildTools.FullName "apksigner.bat"
if (-not (Test-Path -LiteralPath $aapt)) { throw "aapt.exe not found: $aapt" }
if (-not (Test-Path -LiteralPath $apksigner)) { throw "apksigner.bat not found: $apksigner" }

$badging = & $aapt dump badging $toolApkPath 2>&1
if ($LASTEXITCODE -ne 0) { throw "aapt could not inspect the APK." }
$packageLine = $badging | Select-String -Pattern '^package:' | Select-Object -First 1
if (-not $packageLine) { throw "APK package metadata was not found." }
$packageText = $packageLine.Line

foreach ($expected in @(
    "name='com.clinicvoiceroom.staff'",
    "versionCode='$versionCode'",
    "versionName='$versionName'"
)) {
    if ($packageText -notlike "*$expected*") {
        throw "APK metadata mismatch. Expected $expected; actual: $packageText"
    }
}

$manifestTree = (& $aapt dump xmltree $toolApkPath AndroidManifest.xml 2>&1) -join "`n"
if ($LASTEXITCODE -ne 0) { throw "aapt could not inspect AndroidManifest.xml." }
if ($manifestTree -match 'android:debuggable.*0xffffffff') {
    throw "Field APK is debuggable and must not be distributed."
}

& $apksigner verify --verbose --print-certs $toolApkPath
if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed." }

$hash = (Get-FileHash -LiteralPath $resolvedApk -Algorithm SHA256).Hash.ToLowerInvariant()
$checksumPath = "$resolvedApk.sha256.txt"
Set-Content -LiteralPath $checksumPath -Encoding ascii -NoNewline -Value "$hash  $([IO.Path]::GetFileName($resolvedApk))"

Write-Host "MediVoice field artifact verified." -ForegroundColor Green
Write-Host "APK: $resolvedApk"
Write-Host "Version: $versionName ($versionCode)"
Write-Host "SHA-256: $hash"
Write-Host "Checksum file: $checksumPath"
} finally {
    if ($createdMapping) { & subst.exe $DriveLetter /D | Out-Null }
}
