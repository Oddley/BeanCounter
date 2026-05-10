# src/shell/routes/

Per-route components. Each file is mounted at one URL path by `shell/app`.

## Routes

| Path | Component | Purpose |
|---|---|---|
| `/` | `Home` | Decides: redirect to sticky litter if set, else `/litters` |
| `/litters` | `LitterList` | All active litters; toggle to reveal archived |
| `/litters/new` | `NewLitter` | Single combined form: litter name + kitten count + kitten names |
| `/litters/:id` | `LitterDetail` | Kitten list for a litter; sticky toggle; archive controls |
| `/debug` | `Debug` | Raw JSON dump of all Dexie tables (data visibility for dev) |
| `*` | `NotFound` | Catch-all for unknown paths |

## Conventions

- Each route renders an `<AppBar />` for navigation chrome
- Data reads via `useLiveQuery` hooks from `shell/db`
- Mutations via async helpers from `shell/db/mutations`
- Forms are controlled (state-driven), not uncontrolled
- Validation uses pure functions from `core/`

## What does not go here

- Reusable UI primitives → `shell/components/`
- Business logic → `core/`
- Persistence → `shell/db/`
