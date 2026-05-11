# Phase 3 Retrospective

Visualization phase. Per-kitten weight graphs with rough/smooth toggle and tap-to-focus. Lessons captured for Phase 4 (sync).

## Shipped

- `core/time` — local-day helpers (`startOfLocalDay`, `isSameLocalDay`, `localDayKey`, `addDays`, `localDayDiff`); 20 new tests
- `core/graph` — `buildSeries`, `yAxisRange`, `xAxisRange`; supports rough (one point per entry) + smooth (daily-averaged with linear interpolation between known days); 19 new tests
- Recharts integration + three new components: `WeightChart`, `KittenLegend`, `GraphModeToggle`
- New `/litters/:id/graph` route; secondary "📈 Graph" entry point on `LitterDetail`
- Color palette by kitten `order` (stable across re-renders, swappable by reorder)
- Seed-demo-litter button on `/debug` for dev testing
- Refactor: `FeedingSession.tsx` now uses `core/time.isSameLocalDay` (extracted from the inline helper Phase 2 had)
- Total tests: 167 (was 128; +39 for the two new core domains)

## Process Patterns That Continued Working

### Q&A round at sub-phase start

Three questions caught real ambiguities:
- "Linear interpolation" beat "skip days" — user explicitly chose the visually cleaner option over the data-honest one, fully informed
- "Tap-to-focus on legend chip" was the obvious answer, but the explicit "Show all" backup affordance came out of the discussion
- "Never show archived" simplified the data flow

Still hitting alignment on every kickoff. Continue the pattern.

### Red-then-green TDD

Two more core domains added test-first. `core/graph` was especially well-served by tests: the interpolation math is the kind of thing where the test cases ARE the design discussion ("day 1=100 + day 4=130 → expect 110, 120 in between"). Writing those tests first forced specification clarity.

### Per-folder CLAUDE.md before code

`core/time/CLAUDE.md` and `core/graph/CLAUDE.md` written before any test. Pattern continues to pay off — by the time tests are written, the contract is already clear in my head.

### Test-before-push wind-down

Build/test gate caught nothing this phase (no near-misses), but the friction is negligible. Phone test caught nothing either — meaning the design discussions front-loaded the issues. Good sign.

## New Patterns Discovered

### Per-`<Line>` data arrays in Recharts

Standard Recharts examples use one shared dataset with multiple series sharing X values. Our model is different: each kitten can have her own time range (especially in rough mode). The pattern is to give each `<Line>` its own `data` prop and let Recharts handle the rest. Cleaner code; no need to align all kittens' timestamps into one mega-row.

### Library callback types are often wider than you'd assume

Recharts' `labelFormatter` and `formatter` accept `ReactNode | unknown`. My instinct was to annotate as `(label: number) => string`, which TypeScript rejected. Lesson: when wrapping a third-party callback, accept the library's wide type and narrow internally with a `typeof` check or `Number()` coercion. Don't fight the library's contract.

### Debug-route hardcoded seeds as dev tooling

The "seed demo litter" function lives in `Debug.tsx`, not in `shell/db/mutations.ts`. Reasoning: the literal CSV-derived data is a debug concern, not a domain concern. Mutations.ts stays clean (composes pure core constructors against generic inputs); Debug.tsx owns its hardcoded test data. The boundary is "would a non-debug consumer ever use this?" — for `seedDemoLitter`, no.

### Recharts' axis tick auto-formatting + our domain-aware formatter = win

Setting good axis `domain` values + supplying `tickFormatter` is enough for Recharts to produce surprisingly nice tick layout out of the box. No manual tick count, no manual interval logic. The phone-test feedback ("x-axis labeling is exceeding my expectations") came from doing very little: letting Recharts pick ticks while our formatter chose "12:48 AM" vs "5/4" depending on whether they were on the same local day.

### `useMemo` for joined-and-shaped data

`LitterGraph` builds series-all + series-for-chart + xRange + yRange in a single `useMemo`. All four derived from the same inputs; recomputed only when inputs change. Clean pattern for any route that does heavy derivation from reactive data sources.

## Technical Surprises

### Recharts adds substantial bundle weight

Precache went from 404 KB to 752 KB. Recharts is a 350-ish KB library after tree-shaking. Acceptable for MVP; Phase 5 polish can code-split it behind a dynamic import on the graph route specifically.

### `startOfLocalDay` actually correct in TS

The naive midnight-of-local-day computation works correctly across DST in modern JS engines because `new Date(y, m, d, 0, 0, 0, 0)` operates in local time. Took a moment to convince myself. Tests cover it.

### Linear interpolation is honest about what it isn't

Implementation produces interpolated points without flagging them as synthetic. Per the contract, consumers treat them like any other point. Decision rationale: foster mama chose visual cleanliness; if the lack of distinction becomes a problem, we add an "interpolated" boolean to `SeriesPoint` and let the chart render dots differently. Not before.

## Design Lens Validation

- **Tap legend → focus** — predictable touch, no gesture ambiguity
- **"Show all" escape button** — explicit affordance when the tap-again-to-clear gesture is missed in the dark
- **Non-zero-based Y axis** — emphasizes growth, not absolute weight
- **60vh chart height** — readable on small screens, leaves room for legend + toolbar
- **Color stability via `order`** — kittens keep their colors as long as their order doesn't change; reordering remaps colors deterministically
- **Empty-state message** — no jarring "blank rectangle" first impression

Most of these were Q&A decisions, not post-hoc styling. The lens still earns its keep.

## Foster Mama Feedback

None this phase. The graph is something to **show** her in the next test cycle — she'll have opinions about whether daily-average smoothing tells her what she needs, or whether some other smoothing is better. Likely Phase 4 or Phase 5 feedback.

## Carried Into Phase 4 (Sync)

- **`effectiveRecordedAt`** — already the source of X-axis truth in the graph. Same field is what should sync to Google Sheets. Architecture already aligned.
- **Composed `weightEntries.id`** — upserts are trivial both locally and (eventually) when pushing to a remote canonical store.
- **5 additive schema migrations** so far; pattern holds for any sync-state fields added later.
- **`useAllSessions` / `useAllWeightEntries`** are fine at MVP scale but will need litter-scoped variants once a sync layer pulls in larger histories. Not urgent.

## Carried Into Phase 5 (Polish)

- **Code-split Recharts** — dynamic import on the graph route; saves ~350 KB on initial load for users who never view the graph
- **Smoothing UX revisit** — if the linear-interpolation lines become misleading once foster mama uses real data, add an "interpolated" point marker or switch to skip-days mode as default
- **Logo into manifest icons + favicon** — still pending
- **Bundle size warning** at >500 KB — accept now, address in polish

## Stuff to Revisit

- **Per-`<Line>` performance** at 100+ entries — fine at MVP; verify when foster mama has 6 weeks of 6-times-daily data
- **Focus-mode axis rescale animation** — currently instant. Smooth transition would feel nicer but is polish.
- **Reorder kittens during focus** — the color palette remaps; harmless but visually surprising. Probably fine.
