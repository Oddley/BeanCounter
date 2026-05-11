# Phase 2 Retrospective

Feeding-session + weight-entry phase. The UX stress-test phase per the Phase 1 retro. Distilled lessons for Phase 3.

## Shipped

- `core/weight` + `core/session` domains — pure types, validation, lifecycle, time helpers (43 new tests, 128 total across 6 core domains)
- Dexie schema v3 (new `feedingSessions` + `weightEntries` tables) and v4 (`recordedAt` backfill on existing sessions); both migrations additive and idempotent
- `shell/hooks/useAutosave` — debounced async save hook
- `FeedingSession` route — single-screen kitten list with native numeric inputs, auto-advance on Enter, disabled-Finish-until-complete, inline resume modal for stale sessions
- Recordable weigh-in time with a three-state UX (live clock → Start of Weigh In → User-Modified) and native datetime picker
- Three-tier time format (today → "3:42 PM"; this year → "May 9, 3:42 PM"; older → "May 9, 2025, 3:42 PM")
- Pinned-litter redirect now targets the weights screen directly
- UX language: "weights" everywhere user-facing; "FeedingSession" remains the domain type

## Process Patterns That Continued Working

### Q&A round at sub-phase start

Five Q&A rounds across Phase 2, each focused (2–4 questions). Every one caught at least one wrong default I would have shipped:
- "Native keyboard, not custom keypad" reversed my recommendation
- "Tappable in state A pre-creates session" reversed the recommended cleaner option
- "Pin to weights, not litter detail" course-corrected an in-flight bug before it was tested
- The 5-bug-and-tweak round caught Enter-advancement + Finish-disabled-state in a single pass

### Red-then-green TDD

Two more core domains landed with full test-first discipline. 43 new tests, zero retroactive coverage. The discipline never slows things down — it shapes interfaces correctly the first time and renders implementation almost mechanical once the test expresses intent.

### Test-before-push wind-down

Caught zero bugs this phase (no near-misses), but the friction is negligible and the safety net is real. Keeping it.

### Per-folder CLAUDE.md before code

All four new directories (`core/weight`, `core/session`, `shell/hooks`, plus implicit updates to `shell/db`) had their contract written first. Pattern holds.

## New Patterns Discovered

### "Use the platform" wins consistently

Two near-misses for over-engineering:
- I recommended a custom numeric keypad (~150 LOC). User chose `inputmode="numeric"` (0 LOC). Right call: foster mama gets her customized keyboard, autocomplete preferences, language settings.
- I would have built a custom time picker. Used `<input type="datetime-local">` overlaid with `opacity: 0`. Native picker on Android/iOS, zero implementation effort, full date+time editing.

Both decisions trace to: **prefer native HTML capabilities until they demonstrably can't carry the UX.** Override when proven necessary, not by anticipation.

### Three-state query results: `T | null | undefined`

Building on ADR-004's "loading ≠ absent" lesson, queries where "doesn't exist" is a meaningful state get three return states:
- `undefined` — still loading
- `null` — resolved, no record exists
- `T` — the record

`useOpenSessionForLitter` uses this; callers branch on all three explicitly. Cleaner than `T | undefined` + a second flag.

### State machine in component-local state + Dexie persistence

The time bar's three states (NOW / Start of Weigh In / User-Modified) map cleanly to data:
- No session yet → NOW (live clock)
- Session with `recordedAt = 0` → Start of Weigh In (display `createdAt`)
- Session with `recordedAt > 0` → User-Modified

No separate `isUserModified` flag. The data model encodes the state. Component just renders what's in the database.

### Composed primary keys for upsert-by-tuple

`WeightEntry.id = \`${sessionId}:${kittenId}\`` makes "the weight for kitten K in session S" a single trivial `.put()` upsert. No compound index, no "is there already one?" lookup. Clean and idempotent.

## Technical Surprises

### Dexie variadic transaction maxes at 4 tables

`db.transaction('rw', t1, t2, t3, t4, fn)` works; adding a 5th overflows the overload. Switch to `db.transaction('rw', [t1, t2, t3, t4, t5], fn)`. Caught at typecheck, fix was 30 seconds.

### `HTMLInputElement.showPicker()` works, but isn't needed

I planned to programmatically open the datetime picker via `showPicker()`. Discovered that styling the input as `position: absolute; inset: 0; opacity: 0` over a styled display area lets the OS-native tap behavior do all the work — no JS event handler needed. Cleaner than `showPicker()`.

### `exactOptionalPropertyTypes` is invisible until it isn't

Caught the `error: validation.errors[0]` issue (returns `string | undefined`, prop expects `string`). The `?? ''` pattern is now reflex. Each instance teaches the invariant.

## Design Lens Validation

"One-handed, dark, half-asleep" earned its keep this phase:

- **Auto-advance via `enterKeyHint = next`** — eliminates a tap-to-focus per kitten
- **Disabled Finish until all entered** — eliminates the "did I miss one?" anxiety state
- **Time bar always visible** — answers "what time is this?" without looking at a clock
- **Reset button only when modified** — silent UI when nothing's wrong, explicit affordance when something needs unwinding
- **Native keyboard** — every customization foster mama has made to her phone keyboard carries through
- **Single-screen kitten list** — no per-kitten navigation taps

Most of these were Q&A-round decisions, not implementation choices. The lens shapes the architecture, not just the styling.

## Foster Mama Feedback Round (Mid-Phase)

Three rounds of feedback during Phase 2, each <1 hour to incorporate:

1. **Round 1 (post-scaffold)**: pin redirect (bug), MM-DD as placeholder (not pre-filled), pin-as-default checkbox in create flow, kitten min count = 1
2. **Round 2 (post-FeedingSession)**: Enter advances (bug), last-row "done" keyboard, Finish disabled until complete, "weights" naming, pin → weights screen
3. **Round 3 (mid-time-bar)**: time-only when today, date when different day

The architecture absorbed all of these without resistance. Most feedback was UX, not data-model. The FC/IS split kept Dexie schema unchanged across rounds 1 and 2; only Round 3 needed a v4 migration (adding `recordedAt`), and that was additive.

## Scope Expansion That Paid Off

The recordedAt feature wasn't in the MVP spec. The spec said `timestamp (optional override)` on WeightEntry; we built a session-level user-facing time with a 3-state UX. Total: ~150 LOC, one schema migration, one new pure function (`effectiveRecordedAt`), three new tests.

That scope creep was worth it because it shipped real UX value (time visible, editable, resettable) that foster mama specifically asked for. The lesson: respond to in-the-moment user feedback when it's clearly tied to value, even if it's not in the original plan. The architecture made it cheap.

## Carry Into Phase 3 (Visualization)

- **Extract `core/time/`** — `isSameLocalDay`, time-bucket helpers, daily averaging. Currently the date-comparison helper lives in `FeedingSession.tsx`; lift it before Phase 3 needs the same logic for graph buckets.
- **Time-formatting helpers** (`formatClockTime`, `toLocalDatetimeInputValue`) — also currently route-local. Lift to a `shell/format/` module if Phase 3 reuses them.
- **Auto-advance + focus-management pattern** — applicable to any multi-input form. Generalize if Phase 3 needs another.
- **Graph data model** — per-kitten timeseries from weight entries, sorted by `effectiveRecordedAt` (the user's intended time, not the audit timestamp). Already aligned.

## Carry Into Phase 4 (Sync)

- **Four schema migrations so far, all additive.** Discipline holds. Phase 4 will need more (auth state, sync metadata); follow the same pattern.
- **Composed `WeightEntry.id`** — sync's upserts are trivial. Same id format works locally and remotely.
- **`recordedAt` vs `createdAt`** — exactly what Sheets sync needs: send user-facing time, keep system audit time local-only.
- **`clientWriteId` on every weight entry** — already populated, ready to use for idempotent push.

## Stuff to Revisit

- **"Clear all weights → time back to NOW"** — deferred. Becomes relevant when per-field weight clearing lands.
- **Empty sessions** (from state A pre-create) — accepted as harmless noise. May want a cleanup pass eventually.
- **Per-WeightEntry timestamp** — currently set to `Date.now()` at save. Could repoint to `effectiveRecordedAt(session)` for consistency. Phase 4 sync question.
