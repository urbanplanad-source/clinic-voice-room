param(
    [string]$DriveLetter = "Q:"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$javaHome = Join-Path $repoRoot ".tools\jdk-17\jdk-17.0.19+10"
$androidHome = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$createdMapping = $false

if (-not (Test-Path -LiteralPath $javaHome)) {
    throw "Workspace JDK not found: $javaHome"
}
if (-not (Test-Path -LiteralPath $androidHome)) {
    throw "Android SDK not found: $androidHome"
}

$existing = (& subst.exe) | Where-Object { $_ -match "^$([regex]::Escape($DriveLetter))\\:" }
if ($existing) {
    $mappedPath = (($existing -split "=>", 2)[1]).Trim()
    if ([IO.Path]::GetFullPath($mappedPath).TrimEnd('\') -ne $repoRoot.TrimEnd('\')) {
        throw "$DriveLetter is already mapped to a different path: $mappedPath"
    }
} else {
    & subst.exe $DriveLetter $repoRoot
    if ($LASTEXITCODE -ne 0) { throw "Failed to map $DriveLetter to $repoRoot" }
    $createdMapping = $true
}

try {
    $env:JAVA_HOME = "$DriveLetter\.tools\jdk-17\jdk-17.0.19+10"
    $env:ANDROID_HOME = $androidHome
    Set-Location "$DriveLetter\android-staff-app"
    & .\gradlew.bat --no-daemon --max-workers=4 "-Dorg.gradle.jvmargs=-Xmx1536m -Dfile.encoding=UTF-8" :app:testDebugUnitTest :app:testFieldUnitTest :app:lintField
    if ($LASTEXITCODE -ne 0) { throw "MediVoice Android verification failed." }
    Write-Host "MediVoice Android verification passed." -ForegroundColor Green
} finally {
    Set-Location $env:USERPROFILE
    if ($createdMapping) { & subst.exe $DriveLetter /D | Out-Null }
}
