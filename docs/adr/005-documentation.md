# ADR-005: Documentation Standards

**Status:** Accepted

**Decision:** Documentation is written for AI consumers first, humans second. Markdown only. Inverted pyramid structure (most load-bearing information first). The majority of documentation lives proximal to the code it describes, in per-folder `CLAUDE.md` files.

## Inverted Pyramid for AI

Traditional docs bury the lede. AI sessions cold-start from context — lead with the decision or contract, then supporting detail, then examples.

```
Most important (what + rule)       ← first paragraph / heading
  Supporting context (why)         ← second
    Concrete application (how)     ← third
      Examples / edge cases        ← last
```

Never open with "Introduction", "Background", or "Overview" before the point.

## File Placement

| File | Purpose |
|---|---|
| `CLAUDE.md` (repo root) | Project identity, principle index, directory map, key invariants |
| `docs/adr/README.md` | ADR index |
| `docs/adr/NNN-title.md` | One architectural decision per file |
| `src/core/[domain]/CLAUDE.md` | Domain contract: inputs, outputs, invariants, dependencies |
| `src/shell/[feature]/CLAUDE.md` | Feature entry points, side effects, shell dependencies |

Every new directory in `src/` gets a `CLAUDE.md` before any code is written.

## Per-Folder CLAUDE.md Template

```markdown
# [Module Name]

[One sentence: what this module does and what it produces.]

## Inputs
[What this module receives — types, sources]

## Outputs / Contract
[What this module guarantees — return types, invariants]

## Dependencies
[What this module imports from — other core domains, shell, external]

## Invariants
[Rules that must always hold — tested via ADR-003]
```

## Code-Level Writing Rules

- Comments: only when WHY is non-obvious — a hidden constraint, a workaround, a subtle invariant
- Never describe what the code does (names do that)
- No multi-line comment blocks — one line maximum
- If it needs a comment, rename it first
- No JSDoc on internal functions — only on public API surfaces where the type signature is insufficient

## Anti-patterns

- Documentation placed far from the code it describes
- README files that open with history or motivation before function
- Comments that say what (`// increments counter`) rather than why
- Trailing summaries in AI responses — the diff is the summary
