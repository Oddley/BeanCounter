# Post-1.0 Audit Backlog

Tasks that don't make sense to chase before we have a stable 1.0 — either because they target a moving surface (docs that keep changing as phases land) or because they require infrastructure decisions we shouldn't make under pressure.

Revisit this file once Phase 5 (Polish + Install) ships and we declare 1.0. Don't pick at items piecemeal during active phase work — wait for the audit moment so we do them all against a settled codebase.

> **Planning model shift (mid-Phase-4.5):** explicit "Phase X" plans have been replaced by GitHub Issues. Concrete actionable work lives there; this file now only holds architectural notes that aren't yet (or maybe ever) tied to a discrete task. See `docs/backlog.md` for the queue of issues to file.

## Items

### Documentation audit pass

Project documentation has accumulated some drift as phases pivoted (Sheets → Drive in Phase 4, ambient sync → explicit-save in the post-Phase-4 pivot). A single sweep at 1.0 catches all stale references at once.

Scope:
- `README.md` — sync backend description, quickstart, project-status line, deploy URL once Cloudflare is live
- `docs/SETUP.md` — generalize from "Branden — Toolchain Setup" to a forkable doc
- `docs/SETUP-DRIVE.md` — verify all 6 steps still match current GCP UI; add production-origin guidance
- `docs/adr/` — confirm each ADR still reflects shipped reality (ADR-007 in particular may need an addendum for the explicit-save pivot)
- Per-folder `CLAUDE.md` files — spot-check that contracts match implementations
- Phase retrospectives (`docs/phase-*-retrospective.md`) — leave as historical records, no updates needed

Output: one PR that touches everything in one diff, easy to review.

### ~~In-app issue reporting~~ — DONE (basic version)

Pulled forward from post-1.0 because foster mama is actively giving feedback during Phase 4.5 testing. Shipped in mid-Phase-4.5:
- `.github/ISSUE_TEMPLATE/bug_report.yml` + `feature_request.yml` + `config.yml`
- Settings → Feedback section with "Report a bug" + "Request a feature" buttons

**Still deferred for the audit:**
- **GitHub Project (board)** for triaging issues across columns (Todo / In Progress / Done). Worth doing once issue volume justifies it, with thought-through column structure and labels. Today there are zero issues, so a board would be theatre.
- **Label taxonomy** — currently using only default `bug` + `enhancement`. Once we've got 10+ issues, audit usage and add `sync` / `ui` / `docs` / `core` / etc. if patterns emerge.
- **Pre-fill app version + git SHA** in the bug-report template so reports automatically include "what build was this on." Requires wiring `VITE_APP_VERSION` (or similar) at build time and passing it as a `?body=` query param in the issue-new URL. Small but cross-cutting (build config + Settings link).

### Cloudflare deploy doc

Document the Cloudflare Workers+Pages setup we landed on (not the classic Pages flow with `_redirects`). Specifically:
- Branding is "Workers + Pages" / `*.workers.dev` URL, not `*.pages.dev`
- SPA fallback handled by auto-generated wrangler config (`not_found_handling: "single-page-application"`), NOT a `_redirects` file (which fails validation on this platform)
- Deploy is triggered on every push to main
- Build command: `npm run build`, output dir: `dist`
- Env vars: `VITE_GOOGLE_CLIENT_ID` + `VITE_GOOGLE_API_KEY` set in the Cloudflare project's Production env

Should land in `docs/DEPLOY.md` (new) or as a section in `README.md` quickstart.

### Other items that will accumulate here

Drop new ones below as they come up during Phase 4.5 / 5. Anything that's "we should do this eventually but not while target is moving" → goes here.

- (none yet)
