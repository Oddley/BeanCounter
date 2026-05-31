# android/ — Bean Counter Sync sidecar

Small Android foreground service that holds persistent Google Drive credentials and
exposes them to the Bean Counter PWA via a local HTTP server on `localhost:7734`.

## Why this exists

The PWA's OAuth flow requires a user-gesture popup to refresh Drive tokens. On Android
we can use native Google Sign-In (play-services-auth) to store tokens in the system
credential store and refresh them silently forever. This service is that bridge.

## Architecture

```
[Bean Counter PWA (Chrome)] ──HTTP localhost:7734──> [SyncForegroundService]
                                                           │
                                                     [LocalHttpServer]  ← NanoHTTPD
                                                           │
                                                     [DriveApiClient]   ← OkHttp
                                                           │
                                                     [DriveTokenManager] ← play-services-auth
                                                           │
                                                    Google Drive REST v3
```

## Key files

| File | Purpose |
|---|---|
| `MainActivity.kt` | One-time setup: Google Sign-In UI, starts/stops service |
| `SyncForegroundService.kt` | Foreground service; owns server lifecycle; START_STICKY |
| `LocalHttpServer.kt` | NanoHTTPD on 127.0.0.1:7734; six endpoints |
| `DriveApiClient.kt` | OkHttp Drive v3 client; mirrors shell/drive/api.ts |
| `DriveTokenManager.kt` | Silent token refresh via GoogleAuthUtil |
| `BootReceiver.kt` | Restarts service after device reboot |

## HTTP endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | /ping | Liveness; PWA polls this to detect sidecar |
| GET | /auth | `{authenticated, email}` |
| GET | /connection | Stored `{folderId, fileId?, folderName?}` |
| POST | /connection | PWA pushes its localStorage values here |
| GET | /inspect | Reads Drive file; returns InspectionResult JSON |
| POST | /write | Creates/updates Drive file; returns `{fileId}` |

## Building

Open the `android/` directory in Android Studio. Or from the command line:

```
cd android
./gradlew assembleDebug
# APK at: app/build/outputs/apk/debug/app-debug.apk
```

## Google Cloud setup (one-time)

In the same Google Cloud project as the PWA web client ID:
1. APIs & Services → Credentials → Create credential → OAuth 2.0 Client ID
2. Application type: Android
3. Package name: `dev.oddley.beancounter.sync`
4. SHA-1: run `cd android && ./gradlew signingReport` and copy the debug SHA-1
5. No additional scopes needed — the Drive scope is requested at sign-in time

## Distribution

Build a debug APK and share it via GitHub Releases or direct download. The PWA's
setup wizard links to the GitHub Releases page. No Play Store account needed.
