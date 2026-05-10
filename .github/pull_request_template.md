## Summary

<!-- What does this PR do? One sentence. -->

## Checklist

### TDD (ADR-003)
- [ ] Failing test written before implementation (red before green)
- [ ] All new core functions have tests
- [ ] Predictable failure states and Null Object returns covered

### Architecture (ADR-002)
- [ ] No business logic in `src/shell/`
- [ ] No async/I/O in `src/core/`
- [ ] Core does not import from shell

### Null Object (ADR-004)
- [ ] No `null` or `undefined` returned from core functions
- [ ] No absence-gating conditionals added to core

### Code Quality (ADR-001, ADR-005)
- [ ] No `any` types introduced
- [ ] No comments describing *what* — only *why* where non-obvious
- [ ] Every new `src/` directory includes a `CLAUDE.md`

### Git (ADR-006)
- [ ] All commits follow `type(scope): description` format
