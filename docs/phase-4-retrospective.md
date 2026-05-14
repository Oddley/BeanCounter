# Phase 4 Retrospective

Google Drive sync. The largest phase by code volume (4a–4d sub-phases plus a Picker pivot mid-flight). What we learned distilled for Phase 5 and beyond.

## Shipped

- **Architecture pivot** mid-phase: Sheets → Drive (ADR-007), then again from "BeanCounter/ hardcoded folder" → "Picker-selected folder" with Drive-native sharing for multi-user
- `core/active-file` — pure serialize / parse with schema-version forward-compat (11 tests)
- `core/sync` — pure per-entity LWW merge with conflict aggregation across all entity types (25 tests)
- `lastUpdatedAt` field on Litter / Kitten / AppSettings (with TDD updates to every existing mutator)
- `shell/auth` — Google Identity Services + Google Picker integration; folder ID persisted in localStorage; `getValidToken` with silent-then-interactive fallback
- `shell/sync` — orchestrator (singleton-in-flight runSync), dirty-flag with debounce, visibilitychange foreground listener, boot reconnect state
- Settings state machine: connect / pick folder / inspect / push or pull or warn-then-pull / synced / connected
- Sync indicator with 4 states; tap → Settings; "Sync now" button with interactive auth fallback
- `npm run dev:start / dev:stop / dev:status` for detached server lifecycle
- Total tests: 205 (was 167 entering Phase 4; +38 across the new core domains)

## Process Patterns That Continued Working

### Q&A round at sub-phase start

Probably the most-used pattern this phase. Decisions made via Q&A that would have been expensive to retract:
- Drive vs Sheets (kickoff)
- One-file-for-active vs file-per-litter (kickoff)
- Single-account vs multi-account-via-Picker (mid-phase pivot)
- Folder format: `YYYY-MM-DD-<litter-id>.json` (kickoff refinement)
- Archive surfacing on new devices = deferred to future phase
- Picker model B accepted as small extra scope

Every one of these would have been a refactor if we'd guessed wrong. The mid-phase Drive→Picker pivot was particularly important — pivoting before code beat finding out after.

### Red-then-green TDD on core

`core/active-file` and `core/sync` both written test-first. The merge logic in particular benefited — tie-with-different-content edge cases got pinned down by tests before the implementation, and the tests caught a few off-by-one cases during impl.

### Test-before-push wind-down

Caught real bugs this phase, not just regression confidence:
- Phone test caught the popup-blocked-on-boot issue (Phase 4b)
- Phone test caught the last-weight-input-doesn't-save bug (Phase 4d)
- Phone test caught the silent-refresh-fails-on-reload issue (Phase 4d)

Without the test-before-push gate, all three would have shipped to foster mama.

## New Patterns Discovered

### "Browser-security reality" as a category of constraint

Repeatedly during Phase 4, the right architecture was bounded by **what browsers actually allow** rather than what the API docs suggest. Examples:

- `prompt: 'none'` silent refresh is documented as "no UI" but reliably opens an invisible iframe popup that gets blocked when third-party cookies are restricted (default in many browser/profile combos).
- OAuth popups require a user gesture; can't open from a `useEffect`.
- LAN IPs are not valid OAuth origins; needed nip.io as a public-TLD shim.
- iOS Safari with strict tracking prevention silently fails operations that work elsewhere.

Lesson: when GSI / OAuth / browser features are involved, **always test on a real device with default settings before assuming the docs describe reality**. The Anthropic API and our domain logic don't have this issue — browsers do.

### `allowInteractive` boundary for sync triggers

Triggers split into two categories:
1. **User-gesture-originated** (Sync now button, future Finish-weights). Can fall back to interactive consent popup. `allowInteractive: true`.
2. **Background** (debounce, foreground-return). Must stay silent — random consent popups mid-feeding are unacceptable UX. `allowInteractive: false`.

The runSync function honors both. The same orchestration path works for both; only the auth fallback differs.

### Dirty-flag with circular-import-safe wiring

`shell/sync/dirty.ts` has no imports from the orchestrator. The orchestrator wires itself in via `setOnDebounce(cb)` at module-load time, and signals suspension via `setSuspended(boolean)` around the apply-merged-to-local writes. This pattern lets two modules cooperate without creating an import cycle that breaks tree-shaking or test isolation.

Mutations in `shell/db/mutations.ts` import `markDirty` directly from `shell/sync/dirty.ts` (not via the sync barrel) for the same reason.

### Unmount-flush + onBlur-flush for autosave reliability

The `useAutosave` debounce hook originally lost the last edit when the user navigated away within 400ms. The fix is dual:
- **onBlur** flushes when the input loses focus (Enter-to-next, tap-elsewhere, navigation-induced blur).
- **Unmount cleanup** flushes any still-pending edit before tearing down.

Both no-op when there's nothing pending, so they overlap safely. This pattern is generalizable to any "debounced save" hook — assume the user will leave mid-debounce and design for it.

### Schema version forward-compat guard

`core/active-file/parse.ts` refuses files written by a newer schema version than the current app. Cheap to add (one comparison), prevents an older device from clobbering a newer device's file after a future schema bump. Should be the default for any persisted-file format.

## Technical Surprises

### Drive Picker + `drive.file` scope is enough for multi-user

The intuition was "shared folders need broader scope." Actually false: `drive.file` grants access to any file the user explicitly opens via the Picker, including files shared from another Google account. The Picker is the load-bearing mechanism for the multi-user story without scope creep. Documented in Google's docs but easy to miss.

### Dexie `db.transaction()` variadic API maxes at 4 tables

Already learned in Phase 2; bit us again in Phase 4 when applySnapshotToLocal needed 5 tables. Array form (`[t1, t2, t3, t4, t5]`) works. Worth standardizing on the array form everywhere.

### Node `spawn` on Windows needs `shell: true` for `.cmd` files

For the dev-server scripts, `spawn('npm.cmd', [...])` errored with EINVAL on Windows. Adding `shell: process.platform === 'win32'` fixed it but added a deprecation warning about arg escaping. Acceptable since our args are hardcoded, not user-derived.

### Vite 5+ blocks unknown hostnames by default

`server.allowedHosts` defaults to `['localhost', ...IPs]`. To accept `.nip.io` hostnames for OAuth-origin-shim purposes, had to add `allowedHosts: ['.nip.io']` explicitly. Fail-closed by default; correct security stance, but surfaced as a non-obvious "Blocked request" error.

## Design Lens Validation

"One-handed, dark, half-asleep" continued to shape choices in Phase 4 even though most of the work was infrastructure-y:

- **Foster mama never has to think about sync** — once connected, edits silently push within 60s; foreground returns auto-pull; Finish-weights syncs immediately. The only forced interaction is the once-per-session "Sync now" tap (forced by browser security).
- **Destructive warnings have explicit confirms** — Flow B (Drive has data + local has data) requires a tap that says "Replace local with Drive." No silent destructive paths.
- **Indicator + Settings expose what's happening** — 4 distinct states; tappable; status sheet shows last-synced + conflicts. The user can always check rather than guess.
- **Errors surface immediately** — sync indicator goes red as soon as a sync fails; doesn't bury the failure.

The "one-handed" lens also influenced the autosave-flush-on-blur fix: a user who taps Back has both hands busy with the phone; we shouldn't lose their work because of a 400ms timer.

## Foster Mama Feedback (Implicit)

No direct foster-mama testing this phase — it's been Branden-as-developer testing with seeded data and a hypothetical multi-user scenario. The Drive setup overhead (Google Cloud Console + Picker + API key) means foster mama won't see this phase until Branden hands her a working build. Phase 5 polish is when she gets her hands on it.

## Carry Into Phase 4.5 (Sync Polish)

The scope deferred at Phase 4 kickoff:
- **Conflict resolution UI** — A-vs-B field picker triggered from the red sync indicator. The conflict count is currently displayed in Settings; clicking it should reveal per-entity conflicts with a "keep this" choice per side.
- **Lock-warning inline banner** in FeedingSession route — "Another device is also editing this session." Requires `lockAcquired` field state to actually be checked during sync.
- **30s pull-polling on FeedingSession route only** — refreshes `lockAcquired` from remote so the banner stays current.
- **Disconnect-Drive action** within the app — Settings affordance that clears the token + folder + (optionally) wipes local Dexie.

## Carry Into Phase 5 (Polish + Install)

- **PWA manifest icons** — `logo/logo.png` still not wired into the manifest. Once-only polish.
- **Recharts code-split** — 350 KB savings on initial load for users who don't view the graph.
- **iOS Safari OAuth quirks** — likely worse than what we've seen on PC Chrome; budget some Safari-specific debugging time.
- **First-time-user onboarding** — currently a foster mama opening the app cold needs to know about Drive setup. Probably a one-time "Connect Drive (optional)" callout.

## Stuff to Revisit

- **wipe-then-sync** behavior: wiping locally and then letting auto-sync fire actually re-hydrates from Drive (LWW: local timestamps are 0 from wipe, remote wins). This is correct per the merge math but might surprise a user who wipes intending to "leave the household." The fix is for Disconnect-Drive (Phase 4.5) to clear local state + the stored folder ID together so wipe + disconnect is the explicit "leave" gesture.
- **`requestTokenSilently` reliability** is browser-dependent. Worth checking if FedCM (the newer Google federated-credential API) gives better cross-session refresh. Out of scope for MVP but worth a tracking note.
- **Sync-during-edits race** — if auto-sync fires WHILE the user is mid-edit, the suspended-dirty flag prevents the loop, but the user might briefly see the indicator flicker. Phase 4.5 could improve this with a "is the user actively editing?" guard.
- **Service worker background sync** explicitly out of scope for MVP per ADR-007 — but if foster mama loses wifi mid-edit, the in-flight push will fail silently. Eventually background-sync API would address this.

## Carry Into Phase 4 retrospective itself

The phase that needed the most Q&A. ChatGPT-derived doc surfaced architectural ambiguity that direct discussion settled. The pivot from Sheets to Drive saved an enormous amount of wasted code; the pivot from one-file-per-litter to Picker-selected-folder saved a smaller but still meaningful amount. The Centaur model showed its strength here: Claude defaulted to recommendations that would have been workable but not optimal, and Branden's pushback ("is Drive simpler than you're describing?", "the user should be able to share with another account") improved the architecture before a single line of code was written.
