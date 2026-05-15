# Post-1.0 Audit Backlog

Tasks that don't make sense to chase before we have a stable 1.0 — either because they target a moving surface (docs that keep changing as phases land) or because they require infrastructure decisions we shouldn't make under pressure.

Revisit this file once Phase 5 (Polish + Install) ships and we declare 1.0. Don't pick at items piecemeal during active phase work — wait for the audit moment so we do them all against a settled codebase.

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

### In-app issue reporting

Settings menu affordance that opens GitHub's "new issue" page for this repo with a sensible template (separate buttons for bug report vs feature request, ideally).

Why deferred: requires the GitHub project to have its issue templates set up properly (`.github/ISSUE_TEMPLATE/bug_report.yml` + `feature_request.yml`), which itself implies promoting the repo from "just a repo" to having a Project board for triage. That's worth doing once, against a stable product, with thought-through labels and templates — not piecemeal while the surface area is still shifting.

Scope at audit time:
- Add `.github/ISSUE_TEMPLATE/` with bug + feature templates
- Set up a GitHub Project (board) for the repo, decide on labels (bug / feature / docs / sync / ui / etc.)
- Add a Settings section "Report an issue" with two buttons:
  - "Report a bug" → opens `https://github.com/Oddley/BeanCounter/issues/new?template=bug_report.yml` (and pre-fills the user agent / app version if we can)
  - "Request a feature" → similar with feature_request template
- Consider: does foster mama actually want this, or is it more for technical contributors? Probably both, but UX should be light — one Settings link, not a prominent always-visible button.

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
