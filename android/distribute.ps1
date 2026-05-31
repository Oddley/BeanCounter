# distribute.ps1 — Build debug APK and upload to Firebase App Distribution.
#
# Prerequisites (one-time):
#   npm install -g firebase-tools
#   firebase login
#
# Usage:
#   .\distribute.ps1
#   .\distribute.ps1 -Notes "Fixed the thing"
#   .\distribute.ps1 -Groups "testers"   # override tester group

param(
    [string]$Notes = "",
    [string]$Groups = "testers"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Read Firebase App ID from google-services.json ────────────────────────────
$gsPath = Join-Path $PSScriptRoot "app\google-services.json"
if (-not (Test-Path $gsPath)) {
    Write-Error "app\google-services.json not found. Download it from Firebase Console and place it at android\app\google-services.json"
    exit 1
}
$gs = Get-Content $gsPath | ConvertFrom-Json
$appId = $gs.client[0].client_info.mobilesdk_app_id
if (-not $appId) {
    Write-Error "Could not read mobilesdk_app_id from google-services.json"
    exit 1
}
Write-Host "Firebase App ID: $appId"

# ── Use notes from file if not passed on command line ────────────────────────
if (-not $Notes) {
    $notesPath = Join-Path $PSScriptRoot "app\release-notes.txt"
    if (Test-Path $notesPath) {
        $Notes = Get-Content $notesPath -Raw
    } else {
        $Notes = "Debug build"
    }
}

# ── Build ─────────────────────────────────────────────────────────────────────
Write-Host "`nBuilding debug APK..."
$gradlew = Join-Path $PSScriptRoot "gradlew.bat"
& $gradlew assembleDebug
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit 1 }

# ── Upload ────────────────────────────────────────────────────────────────────
$apk = Join-Path $PSScriptRoot "app\build\outputs\apk\debug\app-debug.apk"
Write-Host "`nUploading to Firebase App Distribution (group: $Groups)..."
firebase appdistribution:distribute $apk `
    --app $appId `
    --groups $Groups `
    --release-notes $Notes

if ($LASTEXITCODE -ne 0) { Write-Error "Upload failed"; exit 1 }
Write-Host "`nDone! Testers in '$Groups' will receive an email with the install link."
