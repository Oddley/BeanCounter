# Bean Counter — Project Context

Local-first PWA: foster caregivers log kitten weights during feeding sessions.
**Primary constraint: one-handed, dark-room, half-asleep operation. Every UX and API decision defers to this.**

Google Sheets is the sync backend, not the primary DB. All interactions work offline first.

## Standards (read before writing any code)

| Concern | ADR |
|---|---|
| Tech stack | [ADR-001](docs/adr/001-tech-stack.md) |
| Architecture (SOLID + FC/IS) | [ADR-002](docs/adr/002-architecture.md) |
| Testing (Red-Green TDD) | [ADR-003](docs/adr/003-tdd.md) |
| Null handling (Nothing is Something) | [ADR-004](docs/adr/004-nothing-is-something.md) |
| Documentation | [ADR-005](docs/adr/005-documentation.md) |
| Git workflow | [ADR-006](docs/adr/006-git-workflow.md) |

## Directory Map

```
src/
  core/           ← pure business logic; fully tested; no I/O
    [domain]/
      CLAUDE.md   ← domain contract: inputs, outputs, invariants
  shell/          ← React components, hooks, Dexie, API calls
    [feature]/
      CLAUDE.md   ← feature entry points and side effects
docs/
  adr/            ← one file per architectural decision
public/
  robots.txt      ← allow all crawlers (User-agent: * / Disallow:)
```

## Route / Barrel Split (do not undo)

`src/shell/routes/index.ts` only exports **eager** routes: `Home`, `LitterList`, `LitterDetail`, `NewLitter`, `FeedingSession`, `ErrorBoundary`. These land in the main bundle.

The following are **lazy-loaded** via `React.lazy()` in `App.tsx` and must **not** be re-added to the barrel:

| Route | Why lazy |
|---|---|
| `LitterGraph` | Pulls in Recharts + D3 (~360 KB chunk). Closes #5. |
| `EditFeeding` | Non-critical path |
| `Settings` | Infrequent |
| `Invite` | One-time setup |
| `ConflictResolution` | Rare |
| `Debug` | Dev-only |
| `NotFound` | Error path |

`WeightChart`, `KittenLegend`, and `GraphModeToggle` are also **not** in the components barrel — they import Recharts and must remain reachable only from the lazy `LitterGraph` chunk.

## Deployment

No CI pipeline. Deploy manually from an interactive terminal (wrangler needs browser OAuth):

```
npm run build
npx wrangler pages deploy dist --project-name bean-counter-branden-conley
```

Cloudflare auto-deploys from the `main` branch. The `cloudflare/workers-autoconfig` branch is Cloudflare's auto-generated config branch — ignore it, the production branch is `main`.

## Key Invariants (these override everything else)

1. Core functions are pure and tested. Shell functions are linear side-effect sequences, not tested.
2. Absence is always represented by a typed Null Object — never by a null/undefined check in core.
3. Red before green — no feature code in core without a failing test first.
4. If it needs a comment, it needs a better name instead.
5. The primary user is one-handed, in the dark, half-asleep. Optimize ruthlessly for this.
