# 🫘 Bean Counter — MVP Specification

## Overview

Bean Counter is a local-first progressive web app designed for foster caregivers to rapidly record and review kitten weight data during feeding sessions.

The system replaces a shared Google Sheets workflow with a faster, interruption-resistant interface optimized for:
- sleep-deprived, one-handed data entry
- frequent interruptions
- low cognitive overhead
- reliable historical trend visualization

**Sync backend:** Google Drive (one `active.json` file for all active litters + immutable archive files per archived litter). See [ADR-007](docs/adr/007-sync-architecture.md). The original spec drafted Google Sheets here; Drive proved a better fit during Phase 3 wrap-up.

---

## Core Principles

- Local-first operation: all interactions work offline
- No data loss tolerance: autosave and buffered writes are mandatory
- Session-based workflow: feeding sessions are the primary unit of interaction
- Minimal friction UX: fastest path to data entry is the default experience
- Human interpretation over automation: no AI health assessment or inference
- Tiny trusted household: 1–3 caregivers sharing operational state, not realtime collaborative SaaS

---

## System Architecture

### Layers

1. UI Layer (PWA)
- Feeding session entry
- Litter management
- Graph visualization
- Settings

2. Local State Layer
- Active feeding session state
- Unsent write buffer
- Cached litter data
- Session timeout tracking

3. Sync Layer (Google Drive — see [ADR-007](docs/adr/007-sync-architecture.md))
- One `BeanCounter/active.json` blob holds all active litter state
- Archived litters become immutable files in `BeanCounter/archive/`
- Foreground-event-driven; per-entity last-write-wins merge
- Conflict surfacing via sync status indicator

---

## Data Model

### Litter
- id
- name
- active (boolean)
- kittens[]
- (Original spec listed `sheet_tab_id`; obsolete with Drive sync.)

### Kitten
- id (stable internal ID)
- display_name (mutable)
- active (boolean)
- litter_id

### Feeding Session
- id
- litter_id
- created_at
- status: active | completed | stale
- lock_acquired: boolean
- last_updated_at

### Weight Entry
- session_id
- kitten_id
- grams
- timestamp (optional override)
- client_write_id (UUID)

---

## Feeding Session Lifecycle

- Session created on first weight entry
- Lock acquired at creation
- Autosave begins immediately
- Session becomes stale after 30 min inactivity
- Resume or restart prompt on return
- No explicit save required

---

## Graphing & Visualization

### Litter Graph
- X-axis: time (continuous)
- Y-axis: grams
- One line per kitten
- Dynamic scaling (non-zero-based)

### Modes
- Rough: actual timestamps
- Smooth: daily averages

### Kitten Focus Mode
- isolates single kitten trend
- rescales axes to kitten range

---

## Sync Behavior

- Offline-first; local Dexie is the source of truth between syncs
- Foreground-event-driven: 60s debounce after edits, immediate on Finish-weights, immediate on litter-edit-exit, pull on foreground-return if >10min stale
- Service worker keeps pushing while backgrounded only if edits are pending
- Per-entity last-write-wins merge via `lastUpdatedAt`
- See [ADR-007](docs/adr/007-sync-architecture.md) for full architecture

---

## Success Criteria

- <60s feeding entry workflow
- zero data loss on interruption
- full offline usability
- accurate trend visualization
