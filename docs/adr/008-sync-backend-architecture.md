# ADR-008: Sync Backend Architecture

## Status
Accepted

## Context
Bean Counter's sync was originally Drive-only, with all Drive-specific logic scattered through the orchestrator, boot module, Settings UI, and auth layer. Adding Firebase as a peer sync option required extracting a clean interface and re-expressing the Drive path through it.

## Decision

### `SyncBackend` interface (`src/shell/sync/backend.ts`)

All sync backends implement:

```typescript
interface SyncBackend {
  readonly kind: BackendKind      // 'offline' | 'drive' | 'firebase'
  readonly displayName: string    // shown in SyncIndicator
  isConfigured(): boolean         // has enough stored config to attempt sync
  inspect(options?): Promise<InspectionResult>   // read remote state
  write(snapshot, concurrencyToken): Promise<string | null> // write merged state
}
```

`InspectionResult` is the canonical shared type (no Drive-specific fields). The Drive backend uses an extended `DriveInspectionResult` internally (with `folderId`/`fileId`), converting to `InspectionResult` at the interface boundary.

### Three implementations

| Backend | File | Storage | Auth | Concurrency |
|---|---|---|---|---|
| `offline` | `backends/offline.ts` | none | none | N/A |
| `drive` | `backends/drive.ts` | Google Drive file | GSI OAuth | HTTP ETags (412) |
| `firebase` | `backends/firebase.ts` | Firestore document | Firebase Auth / Google | `_etag` UUID field + transaction |

The Drive backend absorbs all sidecar logic (wake, retry, transport selection) that previously lived in the orchestrator.

The Firebase backend is **user-owned**: each user provides their own Firebase config (`apiKey`, `authDomain`, `projectId`, `appId`). Data lives at `users/{uid}/state/active`. The Firebase SDK is dynamically imported so it only loads for users with Firebase configured.

### Registry (`backends/registry.ts`)

`getActiveBackend()` returns the singleton for the stored kind (`sync:provider` in localStorage). `setActiveBackend(kind)` switches providers and notifies React subscribers via `useActiveBackendKind()`.

### Orchestrator

`orchestrator.ts` is now backend-agnostic: it calls `backend.inspect()` and `backend.write()`. Both `DriveError(412)` and `ConcurrencyConflictError` trigger the existing retry loop.

### UI

`Settings.tsx` renders `<ActiveProviderPanel />` for the sync section. `ActiveProviderPanel` dispatches on `useActiveBackendKind()` and shows only the current provider's UI. The old `SidecarSetup.tsx` is replaced by `SetupSync.tsx`, a unified provider wizard with paths for Drive, Firebase, and Offline.

## Consequences

**Good:**
- Adding a new sync backend requires only a new file implementing `SyncBackend` + a registry entry.
- Settings shows no irrelevant UI — Drive users see only Drive controls, Firebase users see only Firebase controls.
- Firebase tokens refresh automatically forever; the sidecar is no longer the only way to avoid auth popups on Android.

**Accepted trade-offs:**
- Firebase backend is single-user only (data at `users/{uid}/...`). Multi-user shared households on Firebase are deferred.
- Firebase setup requires the user to create and configure a Firebase project — this is a developer-level task, not suitable for non-technical foster caregivers without a guided walkthrough.
- Drive-specific helpers (`inspectDrive`, `pullActiveToLocal`, `pushLocalToActive`) remain exported from `sync/index.ts` for the Drive-specific invite flow (`Invite.tsx`). These are Drive-specific routes and are accepted as such.

## Deferred
- Firebase multi-user / shared household invite flow
- Provider migration assistant (switching clears the remote connection; local Dexie data is untouched)
