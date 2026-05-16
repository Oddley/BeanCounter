# Issue Backlog — to file on GitHub

Queue of work items ready to file as GitHub Issues. Each entry below is self-contained: title, label set, and body. Once `gh` CLI is installed and authenticated, the labels can be created first, then the issues filed via the commands at the bottom.

This file replaces the explicit "Phase 4.5 / Phase 5" planning sections that previously lived in the original plan + retrospectives. Once these issues are filed, prioritization happens on GitHub.

---

## Label setup (run once)

The repo currently only has GitHub's default labels (`bug`, `enhancement`, etc.). The issues below also reference these custom labels. Create them first:

```bash
gh label create "area:sync"  --color "0e8a16" --description "Drive sync / multi-user"
gh label create "area:ui"    --color "5319e7" --description "User-facing UI / UX"
gh label create "area:perf"  --color "fbca04" --description "Performance / bundle size"
gh label create "area:a11y"  --color "1d76db" --description "Accessibility"
gh label create "area:docs"  --color "bfdadc" --description "Documentation"
gh label create "phase:4.5"  --color "d4c5f9" --description "Multi-user sync polish"
gh label create "phase:5"    --color "c2e0c6" --description "Polish + install (pre-1.0)"
```

`gh label create` fails if the label already exists, so re-running is safe-ish (errors are loud but non-destructive). If you want to update colors later: `gh label edit NAME --color HEX`.

---

## Issue 1 — Lock banner + heartbeat + polling on FeedingSession

**Labels:** `enhancement`, `area:sync`, `phase:4.5`

**Body:**

When two devices in the same household both open a FeedingSession route at the same time, neither knows the other is editing. The risk: both type a weight for the same kitten, last-write-wins eats one of the two. Foster mama loses a 3 AM weight she actually recorded.

Three pieces, tightly related:

1. **Heartbeat field on FeedingSession.** Add `lockHeartbeatAt: number` to the entity. Update every 10s while the FeedingSession route is mounted. Means "this device is actively editing this session as of N seconds ago."
2. **Lock banner.** While on the FeedingSession route, if a peer's `lockHeartbeatAt` for the same session is fresh (within last 60s) and the peer isn't us, render a non-dismissible banner: *"Another device is also editing this feeding."* Stays visible until the peer's heartbeat goes stale or our route unmounts.
3. **30s pull-polling.** While on the FeedingSession route, fire a silent `runSync()` every 30s so we see peer heartbeat updates. Outside this route, the existing nav-driven sync is sufficient.

Detecting "is it us" requires a device identifier; can use a per-install UUID stored in localStorage (generate on first connect, never expires).

Stale-lock handling: heartbeats >60s old are treated as released (covers force-quit / lost wifi / battery-died cases without leaving zombie locks).

**Acceptance criteria:**
- Open the same FeedingSession on two devices → both show the banner within ~30s
- Close the route on one device → the OTHER device's banner clears within ~90s (one heartbeat-stale + one poll)
- Force-quit one device mid-edit → other device's banner clears within 60-90s (no zombie lock)

---

## Issue 2 — Conflict resolution UI (A-vs-B picker)

**Labels:** `enhancement`, `area:sync`, `area:ui`, `phase:4.5`

**Body:**

`core/sync` already detects conflicts (when two devices edited the same entity, timestamps tie, content differs). On detection it aggregates them in `AggregatedConflict[]` and the sync indicator goes red with a "X merge conflicts" count in Settings. **There is currently no UI for resolving them.**

Build a route or modal accessible from the red sync indicator (and from the conflict-count display in Settings) that:

1. Lists each conflict per-entity (kitten / litter / settings / session). Granularity matches `AggregatedConflict`.
2. For each conflict shows "local" version vs "remote" version with a tap-to-pick choice. The picked side is what the merge takes as the canonical value.
3. Batch shortcuts: "Take all local" / "Take all remote" buttons for when one side is clearly correct.
4. After resolution: kicks a new sync with the chosen values to settle both devices.

The conflict-count text in Settings already exists and currently links nowhere — wire it to navigate to this new route.

**Acceptance criteria:**
- Force a conflict (edit same kitten on two devices without syncing between)
- Sync produces non-zero conflict count, red indicator
- Tap red indicator → land in conflict UI
- Pick a side per entity → tap Resolve → indicator goes green, both devices converge

---

## Issue 3 — Disconnect-from-Drive action in Settings

**Labels:** `enhancement`, `area:sync`, `area:ui`, `phase:4.5`

**Body:**

Settings currently has "Disconnect / choose different folder" which clears the stored folder and resets state. That covers the "I'm switching folders" case but not the cleaner "I'm leaving this household / no longer want Drive sync" case.

Add a dedicated **Disconnect from Drive** button that:

1. Severs the Drive connection: clears stored folder ID + name from localStorage; clears in-memory OAuth token
2. **Preserves all local data** (Dexie tables untouched)
3. Prompts the user with that information explicitly before completing: *"This disconnects you from Drive but keeps all your local data (litters, kittens, weights, sessions). To clear local data too, use 'Wipe all data' below."*
4. After confirm: indicator goes to `offline` state; Settings returns to the disconnected step

The existing "Wipe all data" button on the Debug page handles the destroy-local case; Disconnect should explicitly point users there if they want to fully reset.

Resolves the "wipe-then-sync surprises user by rehydrating from Drive" quirk noted in `docs/phase-4-retrospective.md` — explicit Disconnect first, then optional Wipe, is the clean two-gesture path for "leave the household."

**Acceptance criteria:**
- Tap Disconnect → confirm prompt with explicit "data preserved" copy → tap confirm
- Indicator goes offline; Settings shows disconnected state
- All litters / kittens / weights still in /debug
- Reconnect later (fresh folder pick) → existing inspect-and-branch flow runs cleanly

---

## Issue 4 — Code-split Recharts to shrink initial bundle

**Labels:** `enhancement`, `area:perf`, `phase:5`

**Body:**

Production bundle is currently ~796 KB minified (240 KB gzip). Recharts contributes ~350 KB of that. Users who never tap a litter's Graph route still pay that cost on first load.

Lazy-load the LitterGraph route via React's `lazy()` + `Suspense`. Recharts moves to its own chunk that only loads when graph is opened. Initial load drops to ~450 KB minified.

Build config already supports this via Vite's chunking. The change is in `App.tsx` (`lazy(() => import('../routes/LitterGraph'))`) plus a `<Suspense>` boundary somewhere appropriate.

**Acceptance criteria:**
- `npm run build` produces a separate chunk file containing Recharts
- The main bundle drops by approximately 300 KB minified
- Tapping a litter's graph briefly shows a loading state, then renders normally
- No regression in tooltip/selection behavior

---

## Issue 5 — iOS Safari OAuth quirks audit

**Labels:** `bug`, `area:sync`, `phase:5`

**Body:**

The Phase 4 retrospective flagged iOS Safari as likely worse for the OAuth flow than what we tested on Chrome. Safari's strict tracking prevention silently fails operations that work elsewhere — particularly `prompt: 'none'` silent refresh and shared-cookie behavior.

Open-ended bug-investigation issue. Steps:

1. Test on a real iOS Safari device with default settings (tracking prevention enabled)
2. Run the full sync flow: connect to Drive, edit something, navigate (trigger silent sync), close + reopen app, return after >10 minutes
3. Identify which steps fail or behave differently than Chrome
4. Document findings inline in this issue; spin off sub-issues for each concrete fix

Likely candidates for trouble:
- Silent token refresh failing more often → user-gesture popup needed more frequently
- Service worker / cache behavior differences in PWA standalone mode
- "Add to Home Screen" install flow UX

**Acceptance criteria:**
- A documented set of behaviors (working / partial / broken) for the major sync touchpoints on iOS Safari
- Either: each broken behavior has a follow-up issue OR an in-app workaround / messaging adjustment is shipped

---

## Issue 6 — First-time-user onboarding

**Labels:** `enhancement`, `area:ui`, `phase:5`

**Body:**

A new foster caregiver opening Bean Counter for the first time has to figure out a lot on their own: Drive setup is optional but lurking in Settings; they need to know about the Connect button; they don't know what the indicator icon means.

Build a first-launch onboarding flow:

1. Detect first launch (no litters, no settings record indicating a previous session)
2. Show a brief modal or overlay introducing the app: "Bean Counter logs kitten weights one-handed in the dark."
3. Walk through the core flow: add a litter → add kittens → log a feeding → see the graph
4. Mention Drive sync as optional ("If multiple caregivers share this household, connect to Drive in Settings"). Don't force the setup; just point at it.
5. Dismissible / never-shown-again with explicit toggle

Should be light-touch — foster mama shouldn't have to read three screens before her first 3 AM use. Maybe one screen of text + a "Got it" button.

**Acceptance criteria:**
- Clean install → onboarding appears
- Dismiss → never reappears
- Existing-user reinstall (e.g. cleared local then re-pulled from Drive) → does NOT show onboarding (her existing setup pulls in via sync)

---

## Issue 7 — Performance audit (Lighthouse + real-device)

**Labels:** `enhancement`, `area:perf`, `phase:5`

**Body:**

Tracking issue for a Phase 5 performance pass. Run on production deploy (after Recharts code-split lands, Issue #4) on at least:

- Lighthouse mobile audit (Chrome DevTools or `npx lighthouse`)
- Real-device profiling on a mid-range Android (Pixel 6a or similar)
- Real-device profiling on iOS Safari (iPhone 12+)

Capture findings as comments on this issue or spin off sub-issues per concrete fix. Targets:

- Lighthouse Performance: 90+
- Lighthouse PWA: 100 (already mostly there)
- First Contentful Paint on real Android: <2s on 4G
- Time to Interactive: <3s

**Acceptance criteria:**
- Lighthouse report attached / referenced
- Real-device timings captured
- Sub-issues filed for anything blocking the targets

---

## Issue 8 — Accessibility audit (VoiceOver / TalkBack)

**Labels:** `enhancement`, `area:a11y`, `phase:5`

**Body:**

Tracking issue for a Phase 5 accessibility pass. Bean Counter's "one-handed in the dark" UX assumes sighted use, but the underlying flows shouldn't break with a screen reader.

Test:

- iOS VoiceOver: navigate the feeding flow end-to-end
- Android TalkBack: same flow
- Tab order on desktop (focus management for the sync indicator, settings buttons, weight inputs)
- Color contrast on dark theme (the muted-grey copy may be subthreshold)

Capture findings inline. Sub-issues for each fix. Specific concerns to verify:

- The weight inputs should announce kitten name + current value
- The graph route is probably unusable via screen reader — at minimum, a text alternative listing entries chronologically would help
- The sync indicator state should be announced (it's a Link with title; verify it's reachable in tab order)

**Acceptance criteria:**
- VoiceOver / TalkBack can complete a full feeding session entry without sighted help
- Critical state changes (sync indicator) are announced
- Sub-issues filed for anything not meeting that bar

---

## Issue 9 — Deployment + setup documentation

**Labels:** `enhancement`, `area:docs`, `phase:5`

**Body:**

Combines two related doc items captured in `docs/post-1.0-audit.md`:

1. **Cloudflare Workers + Pages setup guide** — what we lived through during Phase 4.5. Different from classic Pages flow (uses wrangler config, no `_redirects` file, `*.workers.dev` URL not `*.pages.dev`). Note the SPA-fallback handled by `not_found_handling: "single-page-application"` so future setups don't reach for `_redirects` and bonk.
2. **README quickstart** for a forker who lands on the GitHub page. Currently README has stale Sheets-not-Drive references and no quickstart. Cover: clone → npm install → copy .env.example → GCP setup pointer → `npm run dev:start`.

Should land as either `docs/DEPLOY.md` (new) + README update, or as a single rewritten README with the deploy info inline. README is probably better — fewer hops for a new contributor.

**Acceptance criteria:**
- README has a working "Try it locally" section that a forker could follow cold
- Sheets references replaced with Drive (currently the README still mentions Google Sheets in two places — embarrassing for a public showcase repo)
- Production deploy URL added (`bean-counter.branden-conley.workers.dev`)
- Cloudflare + GCP setup documented enough that a second household setting this up doesn't have to ask Branden questions

---

## Issue 10 — "Up to date" indicator misleading when bundle is stale

**Labels:** `bug`, `area:ui`, `phase:5`

**Body:**

The Settings → App version section can read "✓ Up to date — last checked Xs ago" when in fact the page is still running JS from a previous deploy. The service worker has detected the new version, activated it via `skipWaiting + clientsClaim`, and our `usePwaStatus` correctly reports `needsRefresh: false` — but the user's currently-rendered page is the old bundle in memory. They have to reload to actually see new code.

This was confirmed during Phase 4.5 testing: foster mama saw "Up to date" while still missing newly-shipped UI changes.

**Possible fix paths:**

- Embed a build hash via `import.meta.env.VITE_BUILD_SHA` (or similar) at build time
- On every poll, fetch a known-changing endpoint (e.g. `/manifest.webmanifest`) and compare against the embedded hash
- If mismatch: render as "Update available — Reload to apply" even if the SW says current

Alternative: just always show a "Reload" button when `lastCheckedAt` is recent enough, regardless of SW state. Less precise but always-true.

**Acceptance criteria:**
- After a deploy, within ~90s, the running PWA reflects "Update available" or equivalent
- Tapping Reload picks up the new bundle
- "Up to date" never shows when the rendered bundle is older than the latest deployed one

---

## Issue 11 — Pre-fill app version + git SHA in bug-report template

**Labels:** `enhancement`, `area:docs`, `phase:5`

**Body:**

The bug-report form currently asks users for "Device & browser" but doesn't capture the running app version. When a user files a bug, we have no way to know which build they're on, which is critical during active development.

Implementation:

1. Add `VITE_APP_VERSION` (or read from git SHA at build) to the Vite build config; expose via `import.meta.env`
2. In the Settings "Report a bug" handler, construct the `window.open(...)` URL with `?body=` pre-filled to include `App version: <sha>` in the Anything-Else field (or a new dedicated field)
3. Also pre-fill device user-agent if cheap to do so

Cleanest probably: a dedicated hidden-by-default "Diagnostic info" textarea in the YAML form, pre-filled from query params.

**Acceptance criteria:**
- Filed bug reports automatically include the build SHA the user was on
- Manually-filed issues (from github.com directly) still work without the pre-fill — the field has a sensible default empty state

---

## Quick-file commands

Once labels are created (above), each issue can be filed via:

```bash
# Issue 1
gh issue create \
  --title "Lock banner + heartbeat + polling on FeedingSession" \
  --label "enhancement,area:sync,phase:4.5" \
  --body-file <(sed -n '/^## Issue 1/,/^---$/p' docs/backlog.md | head -n -1 | tail -n +2)
```

…or just paste each body block from this file into a `gh issue create --body "..."` invocation. Up to taste.

Better: a quick shell script that walks the issues here and files them with one command. Worth writing if we end up doing this regularly (we won't, this is a one-time batch). For now, copy-paste from this doc → done.
