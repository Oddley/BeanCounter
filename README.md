# Bean Counter

> **Work in progress.** This project is in early development. Standards and architecture are established; implementation has not yet begun.

A local-first progressive web app for foster caregivers to log kitten weights during feeding sessions.

Designed for the hardest possible UX condition: one-handed, in the dark, half-asleep.

## What it does

- Fast weight entry during feeding sessions — minimal taps, minimal cognition
- Offline-first — works without a connection, syncs to Google Sheets when available
- Trend visualization — per-kitten weight graphs with daily smoothing

## How it's built

React + TypeScript PWA. Local storage via IndexedDB (Dexie.js). Google Sheets as the sync backend, not the primary database.

Architecture follows Functional Core / Imperative Shell, SOLID principles, and strict red-green TDD. See [`docs/adr/`](docs/adr/) for decisions.

## This repository

Bean Counter is a demonstration of Human/AI pair development — a hobby-scale project held to production standards. The human directs; Claude (Anthropic) authors, tests, and validates. All architectural decisions are recorded in [`docs/adr/`](docs/adr/).

## License

MIT — see [LICENSE](LICENSE).
