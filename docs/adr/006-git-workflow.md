# ADR-006: Git Workflow & Conventional Commits

**Status:** Accepted

**Decision:** Conventional Commits format for all commit messages. Feature branches off `main`. PRs required for all non-trivial changes. PR template enforces TDD and standards compliance.

## Commit Format

```
<type>(<scope>): <imperative description>

[optional body — only when the why is non-obvious from the subject line]
```

### Types

| Type | Use |
|---|---|
| `feat` | New feature (core + shell together, or either alone) |
| `fix` | Bug fix |
| `test` | Adding or correcting tests |
| `refactor` | No behavior change |
| `docs` | Documentation only |
| `chore` | Build, dependencies, config |

### Scope Examples

`core/session`, `core/kitten`, `shell/weight-entry`, `shell/litter-graph`, `sync/sheets`, `pwa`

### Examples

```
feat(core/session): add stale detection after 30min inactivity
test(core/kitten): cover NullKitten substitutability for all Kitten consumers
fix(shell/weight-entry): correct autosave debounce on rapid sequential entries
refactor(core/weight): extract delta computation into pure function
docs(adr): add ADR-004 Null Object Pattern
```

## Branch Naming

```
<type>/<short-description>
```

Examples: `feat/session-lifecycle`, `fix/autosave-debounce`, `docs/adr-null-object`

## PR Rules

- All commits on the branch follow Conventional Commits format
- PR checklist (`.github/pull_request_template.md`) must be completed
- Red-before-green confirmed — no core code without a preceding test commit
- No new `any` types
- No business logic in shell
- Every new `src/` directory includes a `CLAUDE.md`
