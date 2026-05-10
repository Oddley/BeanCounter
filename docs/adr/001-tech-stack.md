# ADR-001: Tech Stack

**Status:** Accepted

**Decision:** React 18 + TypeScript 5 + Vite. Vitest + React Testing Library for tests. Dexie.js for local storage. vite-plugin-pwa + Workbox for offline/PWA. Recharts for visualization.

**Why:** AI is the primary author and validator. React + TypeScript has the strongest FC/IS + SOLID pattern library in AI training data. TypeScript's type system maps naturally to C# (familiar to the human collaborator). Vite + Vitest share a single config, minimizing build complexity. Dexie wraps IndexedDB with a clean typed API suited to local-first.

## Stack

| Layer | Library | Version | Rationale |
|---|---|---|---|
| Framework | React | 18 | Composable, TypeScript-first, large pattern library |
| Language | TypeScript | 5 | Interfaces for SOLID, discriminated unions, strict null checks |
| Build | Vite | latest | Fast, PWA plugin, Vitest colocation |
| Unit tests | Vitest | latest | Vite-native, minimal config, fast |
| Component tests | React Testing Library | latest | Tests behavior, not implementation |
| Local DB | Dexie.js | latest | IndexedDB wrapper, typed, observable, offline-first |
| PWA | vite-plugin-pwa + Workbox | latest | Service worker, offline caching, installability |
| Charts | Recharts | latest | React-native SVG charts, TypeScript-first |
| Linting | ESLint + Prettier | latest | Standard TS config, enforced formatting |

## Constraints

- Target platforms: Android and iOS (PWA). Desktop is a YAGNI non-requirement.
- All dependencies must be free/open source (hobby project).
- No SSR, no server-side runtime — static build only.

## Anti-patterns

- No `any` types — use `unknown` + type narrowing if origin is truly unknown
- No class components — function components + hooks only
- No `useEffect` for derived state — compute in core, not in effects
- No framework lock-in inside `src/core/` — core imports only TypeScript, never React
