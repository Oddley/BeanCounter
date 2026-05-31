# distribute.ps1 — Build debug APK and upload to Firebase App Distribution.
#
# Prerequisites (one-time):
#   npm install -g firebase-tools
#   firebase login
#
# Usage:
#   .\distribute.ps1 -Testers "you@gmail.com"
#   .\distribute.ps1 -Testers "you@gmail.com" -Notes "Fixed the thing"
#   .\distribute.ps1 -Groups "testers"   # if you've set up a group in Firebase Console

param(
    [string]$Notes = "",
    # Direct email(s), comma-separated. Simplest — no Firebase Console setup needed.
    [string]$Testers = "",
    # Named group from Firebase Console → App Distribution → Testers & Groups.
    [string]$Groups = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Fall back to testers.txt if no explicit target was given
if (-not $Testers -and -not $Groups) {
    $testersFile = Join-Path $PSScriptRoot "testers.txt"
    if (Test-Path $testersFile) {
        $Testers = (Get-Content $testersFile | Where-Object { $_ -match '\S' }) -join ","
    }
}
if (-not $Testers -and -not $Groups) {
    Write-Error "Provide -Testers `"email@example.com`" or -Groups `"group-name`", or create android\testers.txt with one email per line"
    exit 1
}

# ── Read Firebase App ID from google-services.json ───────────────────────────
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
        $Notes = (Get-Content $notesPath -Raw).Trim()
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
$target = if ($Testers) { "testers: $Testers" } else { "group: $Groups" }
Write-Host "`nUploading to Firebase App Distribution ($target)..."

$firebaseArgs = @(
    "appdistribution:distribute", $apk,
    "--app", $appId,
    "--release-notes", $Notes
)
if ($Testers) { $firebaseArgs += @("--testers", $Testers) }
if ($Groups)  { $firebaseArgs += @("--groups",  $Groups)  }

firebase @firebaseArgs
if ($LASTEXITCODE -ne 0) { Write-Error "Upload failed"; exit 1 }
Write-Host "`nDone! An install link has been sent to $target"
