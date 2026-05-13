# ADR-007: Sync Architecture

**Status:** Accepted

**Decision:** Sync to **Google Drive** (not Google Sheets). All active litters live in a single `active.json` blob in a `BeanCounter/` Drive folder; each archived litter is a one-way 1-file write into `BeanCounter/archive/`. Merge is per-entity last-write-wins by `lastUpdatedAt`. Sync is foreground-event-driven only — no background polling. Conflict surfacing via the sync status indicator; full resolution UI is deferred to Phase 4.5.

## Why Drive over Sheets

| Concern | Sheets | Drive |
|---|---|---|
| Data shape fit | Nested model crams awkwardly into rows | JSON files map naturally |
| Schema evolution | Column adds, header rows, fragile | Just write new JSON |
| Sync granularity | Row-level reconciliation is complex | File-level "last write wins" is simple |
| Rate limits | Tight for chatty writes | More forgiving for blob ops |
| Conflict resolution | Per-cell merging is a nightmare | File-level reads + per-entity merge |

The original spec inherited "Sheets" from the inspiration ("replaces a shared Google Sheets workflow"), but the actual storage backend was not deeply committed. Drive is the right call.

## Drive Layout

```
BeanCounter/
  active.json                              ← all active litters + kittens + sessions + weight entries + settings
  archive/
    YYYY-MM-DD-<litter-id>.json            ← one per archived litter; immutable once written
```

- Drive folder listing is the "manifest" — no separate manifest file
- `active.json` is the hot path: read and written continuously
- Archive files are written once at archive-time and never modified
- Archive filename leads with the archive date (local time, YYYY-MM-DD) so a human browsing the folder sees them in chronological order; the litter id suffix disambiguates same-day archives

## Archive Scope for Phase 4

Archive files in Drive serve as **persistent backup** in Phase 4 — write-once, read-never. The device that archived the litter retains the data in its local Dexie (with `active=false`); the existing local archive UI continues to work there. A different device that connects later will NOT see those archived litters surface in its local UI.

Cross-device archive surfacing (listing archive files from Drive on devices that don't have them locally), in-app archive viewer, CSV export, and similar "what can I do with an archived litter beyond knowing the file exists in Drive" features are deferred to a future phase beyond 4.5.

## OAuth

- **Library:** Google Identity Services (GSI) — `google.accounts.oauth2.initTokenClient`
- **Scope:** `drive.file` — access only files our app created (minimum permission)
- **Token:** in-memory only; silent refresh via GSI on need; never persisted in localStorage
- **Token failure (401):** sync indicator goes red; tap to reconnect (re-prompts GSI consent if needed)

## Merge Strategy — Per-Entity Last-Write-Wins

Every syncable entity has a `lastUpdatedAt: number` (millis since epoch). Every mutation bumps it to `Date.now()`.

| Side has entity E? | Action |
|---|---|
| Only local has E | Keep local |
| Only remote has E | Take remote |
| Both, `local.lastUpdatedAt > remote.lastUpdatedAt` | Keep local |
| Both, `remote.lastUpdatedAt > local.lastUpdatedAt` | Take remote |
| Both, equal `lastUpdatedAt`, identical content | No-op |
| Both, equal `lastUpdatedAt`, different content | **Conflict** — flag for sync indicator |

The merge is pure (lives in `core/sync`); the resulting state is written back to `active.json` and applied to local Dexie.

### Known Lossy Case

If Device A archives Kitten K at 3pm and Device B (without seeing A's change) renames K at 4pm, B's rename wins (newer timestamp) and silently undoes A's archive. This is the unavoidable cost of timestamp-LWW without operation logs. Acceptable for "tiny trusted household" scope; surfaced via the conflict indicator when we can detect it. CRDT-grade resolution is explicitly out of scope (per MVP architecture summary).

## Sync Activity Model — Foreground Only

| Context | Behavior |
|---|---|
| Foreground, edits pending | 60s debounce push; tap indicator to sync now |
| Foreground, "Finish" or "Back from edit" tap | Immediate push |
| Foreground, on FeedingSession route (Phase 4.5) | Light pull every ~30s for lock-state freshness |
| Foreground, no pending edits, not on FeedingSession | Quiet |
| Backgrounded, edits pending | Service worker keeps pushing until clean, then quiet |
| Backgrounded, no edits | Quiet |
| Foreground return after >10 min since last sync | Single pull to check remote freshness |

No wall-clock background polling. Battery and quota friendly.

## First-Connect Flows

**Flow A — Drive folder doesn't yet contain `active.json`:**
1. Create `BeanCounter/` folder (create-if-missing, idempotent)
2. Snapshot all local active litter data into `active.json`
3. Upload
4. Status: synced

**Flow B — Drive folder contains existing `active.json`:**
1. Show a clear destructive warning: "Connecting to this Drive will replace your local data."
2. On confirm: wipe local Dexie
3. Pull `active.json` and rehydrate Dexie
4. Status: synced

Future kinder workflows (merge instead of replace, "use as backup") are out of scope. "Get with the program" simplicity for v1.

## Sync Status Indicator

Lives in the AppBar right slot. Tapping opens a sync detail sheet with connection state + manual sync action + (when unconnected) "Connect to Drive" button + Debug link.

| State | Visual | Meaning |
|---|---|---|
| Unconnected | `?` icon (muted) | No Drive connection configured |
| Synced | ✓ icon (green) | No pending changes; remote checked within last 10 min |
| Pending | spinner / clock icon (gray-blue) | Either unsaved local changes OR stale remote check; will resolve on next sync |
| Error | ! icon (red) | Sync failed (auth, network, schema mismatch, conflict). Tap for detail. |

## Schema Version Field

`active.json` and each archive file include a top-level `schemaVersion: number`. App reads the field; refuses to overwrite a file written by a newer schema version than the app understands. Lightweight forward-compat sanity check. Migration of legacy formats is not required for MVP (per architecture summary: "Legacy schema compatibility is NOT required for MVP").

## Out of Scope for Phase 4 — Deferred to 4.5

- Conflict resolution UI (manual A-vs-B field picker)
- Inline lock-warning banner in FeedingSession route
- 30s pull-polling during FeedingSession route
- Disconnect-from-Drive action within the app

## Out of Scope for MVP Entirely

- Service worker background sync via the Background Sync API (foreground only)
- Active session locking that BLOCKS concurrent edits (warnings only)
- Conflict-free replicated data types (CRDTs)
- Operation log replay
- Realtime collaboration semantics
