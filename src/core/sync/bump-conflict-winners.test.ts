import { describe, it, expect } from 'vitest'
import { bumpConflictWinners } from './bump-conflict-winners'
import type { ActiveFileSnapshot } from '../active-file'
import type { AggregatedConflict } from './types'
import type { Litter } from '../litter'
import type { Kitten } from '../kitten'
import type { FeedingSession } from '../session'
import type { WeightEntry } from '../weight'
import type { AppSettings } from '../settings'

// Fixture builders to keep tests readable.

function buildSnapshot(overrides: Partial<ActiveFileSnapshot> = {}): ActiveFileSnapshot {
  return {
    settings: { stickyLitterId: '', lastUpdatedAt: 100 },
    litters: [],
    kittens: [],
    feedingSessions: [],
    weightEntries: [],
    ...overrides,
  }
}

function buildLitter(id: string, ts: number, overrides: Partial<Litter> = {}): Litter {
  return {
    id,
    name: `Litter ${id}`,
    active: true,
    lastUpdatedAt: ts,
    ...overrides,
  }
}

function buildKitten(id: string, ts: number): Kitten {
  return {
    id,
    litterId: 'L1',
    displayName: `K-${id}`,
    active: true,
    lastUpdatedAt: ts,
    order: 0,
  }
}

function buildSession(id: string, ts: number): FeedingSession {
  return {
    id,
    litterId: 'L1',
    createdAt: 100,
    lastUpdatedAt: ts,
    recordedAt: 0,
    completed: true,
    lockAcquired: false,
    deleted: false,
  }
}

function buildWeightEntry(id: string, ts: number): WeightEntry {
  return {
    id,
    sessionId: 'S1',
    kittenId: 'K1',
    grams: 100,
    timestamp: ts,
    clientWriteId: `c-${id}`,
  }
}

describe('bumpConflictWinners', () => {
  const NOW = 9_000_000

  it('returns the merged snapshot unchanged when there are no conflicts', () => {
    const snapshot = buildSnapshot({
      litters: [buildLitter('L1', 100)],
    })
    const result = bumpConflictWinners(snapshot, [], NOW)
    expect(result).toEqual(snapshot)
  })

  it('bumps lastUpdatedAt on a settings conflict winner', () => {
    const localSettings: AppSettings = {
      stickyLitterId: 'L1',
      lastUpdatedAt: 100,
    }
    const remoteSettings: AppSettings = {
      stickyLitterId: 'L2',
      lastUpdatedAt: 100,
    }
    const snapshot = buildSnapshot({ settings: localSettings })
    const conflicts: AggregatedConflict[] = [
      {
        entityType: 'settings',
        id: 'settings',
        local: localSettings,
        remote: remoteSettings,
      },
    ]
    const result = bumpConflictWinners(snapshot, conflicts, NOW)
    expect(result.settings.lastUpdatedAt).toBe(NOW)
    expect(result.settings.stickyLitterId).toBe('L1') // unchanged
  })

  it('bumps lastUpdatedAt on a single litter conflict winner', () => {
    const litterA = buildLitter('L1', 100, { name: 'Local' })
    const litterB = buildLitter('L2', 200) // not in conflict
    const snapshot = buildSnapshot({ litters: [litterA, litterB] })
    const remoteLitterA = buildLitter('L1', 100, { name: 'Remote' })
    const conflicts: AggregatedConflict[] = [
      {
        entityType: 'litters',
        id: 'L1',
        local: litterA,
        remote: remoteLitterA,
      },
    ]
    const result = bumpConflictWinners(snapshot, conflicts, NOW)
    expect(result.litters[0]?.id).toBe('L1')
    expect(result.litters[0]?.lastUpdatedAt).toBe(NOW)
    expect(result.litters[0]?.name).toBe('Local') // unchanged
    expect(result.litters[1]?.lastUpdatedAt).toBe(200) // unchanged
  })

  it('bumps lastUpdatedAt on a kitten conflict winner', () => {
    const kitten = buildKitten('K1', 100)
    const snapshot = buildSnapshot({ kittens: [kitten] })
    const conflicts: AggregatedConflict[] = [
      {
        entityType: 'kittens',
        id: 'K1',
        local: kitten,
        remote: buildKitten('K1', 100),
      },
    ]
    const result = bumpConflictWinners(snapshot, conflicts, NOW)
    expect(result.kittens[0]?.lastUpdatedAt).toBe(NOW)
  })

  it('bumps lastUpdatedAt on a feedingSession conflict winner', () => {
    const session = buildSession('S1', 100)
    const snapshot = buildSnapshot({ feedingSessions: [session] })
    const conflicts: AggregatedConflict[] = [
      {
        entityType: 'feedingSessions',
        id: 'S1',
        local: session,
        remote: buildSession('S1', 100),
      },
    ]
    const result = bumpConflictWinners(snapshot, conflicts, NOW)
    expect(result.feedingSessions[0]?.lastUpdatedAt).toBe(NOW)
  })

  it('bumps timestamp (not lastUpdatedAt) on a weightEntry conflict winner', () => {
    // WeightEntry uses `timestamp` as its recency field, not `lastUpdatedAt`.
    const entry = buildWeightEntry('S1:K1', 100)
    const snapshot = buildSnapshot({ weightEntries: [entry] })
    const conflicts: AggregatedConflict[] = [
      {
        entityType: 'weightEntries',
        id: 'S1:K1',
        local: entry,
        remote: buildWeightEntry('S1:K1', 100),
      },
    ]
    const result = bumpConflictWinners(snapshot, conflicts, NOW)
    expect(result.weightEntries[0]?.timestamp).toBe(NOW)
  })

  it('handles multi-entity conflicts across all types', () => {
    const settings: AppSettings = { stickyLitterId: '', lastUpdatedAt: 100 }
    const litter = buildLitter('L1', 100)
    const litterUnchanged = buildLitter('L2', 200)
    const kitten = buildKitten('K1', 100)
    const session = buildSession('S1', 100)
    const entry = buildWeightEntry('S1:K1', 100)
    const snapshot = buildSnapshot({
      settings,
      litters: [litter, litterUnchanged],
      kittens: [kitten],
      feedingSessions: [session],
      weightEntries: [entry],
    })
    const conflicts: AggregatedConflict[] = [
      { entityType: 'settings', id: 'settings', local: settings, remote: settings },
      { entityType: 'litters', id: 'L1', local: litter, remote: litter },
      { entityType: 'kittens', id: 'K1', local: kitten, remote: kitten },
      { entityType: 'feedingSessions', id: 'S1', local: session, remote: session },
      { entityType: 'weightEntries', id: 'S1:K1', local: entry, remote: entry },
    ]
    const result = bumpConflictWinners(snapshot, conflicts, NOW)
    expect(result.settings.lastUpdatedAt).toBe(NOW)
    expect(result.litters[0]?.lastUpdatedAt).toBe(NOW)
    expect(result.litters[1]?.lastUpdatedAt).toBe(200) // unchanged
    expect(result.kittens[0]?.lastUpdatedAt).toBe(NOW)
    expect(result.feedingSessions[0]?.lastUpdatedAt).toBe(NOW)
    expect(result.weightEntries[0]?.timestamp).toBe(NOW)
  })

  it('ignores conflicts that reference entities not present in merged', () => {
    // Defensive: orchestrator should always pass coherent data, but if it
    // doesn't, we silently skip rather than throw.
    const snapshot = buildSnapshot({ litters: [buildLitter('L1', 100)] })
    const conflicts: AggregatedConflict[] = [
      {
        entityType: 'litters',
        id: 'L-NOT-PRESENT',
        local: buildLitter('L-NOT-PRESENT', 100),
        remote: buildLitter('L-NOT-PRESENT', 100),
      },
    ]
    const result = bumpConflictWinners(snapshot, conflicts, NOW)
    expect(result.litters[0]?.lastUpdatedAt).toBe(100) // untouched
  })

  it('does not mutate the input snapshot', () => {
    const litter = buildLitter('L1', 100)
    const snapshot = buildSnapshot({ litters: [litter] })
    const conflicts: AggregatedConflict[] = [
      { entityType: 'litters', id: 'L1', local: litter, remote: litter },
    ]
    bumpConflictWinners(snapshot, conflicts, NOW)
    expect(snapshot.litters[0]?.lastUpdatedAt).toBe(100) // input unchanged
    expect(litter.lastUpdatedAt).toBe(100) // entity unchanged
  })

  it('is idempotent when re-applied with a newer now', () => {
    const litter = buildLitter('L1', 100)
    const snapshot = buildSnapshot({ litters: [litter] })
    const conflicts: AggregatedConflict[] = [
      { entityType: 'litters', id: 'L1', local: litter, remote: litter },
    ]
    const first = bumpConflictWinners(snapshot, conflicts, NOW)
    const second = bumpConflictWinners(first, conflicts, NOW + 1000)
    expect(second.litters[0]?.lastUpdatedAt).toBe(NOW + 1000)
  })
})
