import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppBar, Button } from '../components'
import {
  useConflicts,
  resolveConflictAsLocal,
  resolveConflictAsRemote,
  type ConflictRecord,
  type ConflictEntityType,
} from '../db'
import { runSync } from '../sync'
import type { Litter } from '../../core/litter'
import type { Kitten } from '../../core/kitten'
import type { FeedingSession } from '../../core/session'
import type { WeightEntry } from '../../core/weight'
import type { AppSettings } from '../../core/settings'
import styles from './ConflictResolution.module.css'

// User-facing label per entity type, singular.
function entityLabel(type: ConflictEntityType): string {
  switch (type) {
    case 'settings':
      return 'App settings'
    case 'litters':
      return 'Litter'
    case 'kittens':
      return 'Kitten'
    case 'feedingSessions':
      return 'Feeding session'
    case 'weightEntries':
      return 'Weight entry'
  }
}

// Readable summary of an entity version. Renders a small list of
// key/value rows. Keeps the conflict UI scannable instead of dumping
// raw JSON.
function VersionSummary({
  entityType,
  value,
}: {
  entityType: ConflictEntityType
  value: unknown
}) {
  const rows = summaryRows(entityType, value)
  return (
    <dl className={styles.summary}>
      {rows.map(([label, val]) => (
        <div key={label} className={styles.row}>
          <dt className={styles.dt}>{label}</dt>
          <dd className={styles.dd}>{val}</dd>
        </div>
      ))}
    </dl>
  )
}

function summaryRows(
  entityType: ConflictEntityType,
  value: unknown,
): ReadonlyArray<readonly [string, string]> {
  switch (entityType) {
    case 'settings': {
      const v = value as AppSettings
      return [
        ['Sticky litter', v.stickyLitterId === '' ? '(none)' : v.stickyLitterId],
        ['Updated', formatTime(v.lastUpdatedAt)],
      ]
    }
    case 'litters': {
      const v = value as Litter
      return [
        ['Name', v.name],
        ['Active', v.active ? 'Yes' : 'Archived'],
        ['Updated', formatTime(v.lastUpdatedAt)],
      ]
    }
    case 'kittens': {
      const v = value as Kitten
      return [
        ['Display name', v.displayName],
        ['Order', String(v.order)],
        ['Active', v.active ? 'Yes' : 'Archived'],
        ['Updated', formatTime(v.lastUpdatedAt)],
      ]
    }
    case 'feedingSessions': {
      const v = value as FeedingSession
      return [
        ['Recorded at', formatTime(v.recordedAt || v.createdAt)],
        ['Completed', v.completed ? 'Yes' : 'In progress'],
        ['Updated', formatTime(v.lastUpdatedAt)],
      ]
    }
    case 'weightEntries': {
      const v = value as WeightEntry
      return [
        ['Weight', `${String(v.grams)} g`],
        ['Recorded at', formatTime(v.timestamp)],
      ]
    }
  }
}

function formatTime(millis: number): string {
  if (!millis || millis <= 0) return '—'
  return new Date(millis).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface ConflictCardProps {
  readonly conflict: ConflictRecord
}

function ConflictCard({ conflict }: ConflictCardProps) {
  const onKeepLocal = () => {
    void resolveConflictAsLocal(conflict.id, Date.now())
  }
  const onUseRemote = () => {
    void resolveConflictAsRemote(conflict.id, Date.now())
  }
  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{entityLabel(conflict.entityType)}</h2>
        <p className={styles.cardSubtitle}>
          ID: <code>{conflict.entityId}</code>
        </p>
      </header>
      <div className={styles.versions}>
        <div className={styles.versionColumn}>
          <h3 className={styles.versionHeading}>This device</h3>
          <VersionSummary
            entityType={conflict.entityType}
            value={conflict.localVersion}
          />
          <Button onClick={onKeepLocal} className={styles.choiceButton}>
            Keep this version
          </Button>
        </div>
        <div className={styles.versionColumn}>
          <h3 className={styles.versionHeading}>Other device</h3>
          <VersionSummary
            entityType={conflict.entityType}
            value={conflict.remoteVersion}
          />
          <Button
            onClick={onUseRemote}
            variant="secondary"
            className={styles.choiceButton}
          >
            Use this version
          </Button>
        </div>
      </div>
    </article>
  )
}

export function ConflictResolution() {
  const navigate = useNavigate()
  const conflicts = useConflicts()
  const prevCountRef = useRef<number | null>(null)

  // When the list transitions from non-empty to empty, fire a sync to
  // propagate the user's choices to Drive. Done as a side effect so
  // each resolution can be a plain dispatch — no extra plumbing per
  // button click.
  useEffect(() => {
    if (conflicts === undefined) return
    const prev = prevCountRef.current
    if (prev !== null && prev > 0 && conflicts.length === 0) {
      void runSync()
    }
    prevCountRef.current = conflicts.length
  }, [conflicts])

  const goHome = () => {
    void navigate('/')
  }

  if (conflicts === undefined) {
    return (
      <>
        <AppBar title="Sync conflicts" backTo="/settings" />
        <main className={styles.main}>
          <p className={styles.muted}>Loading…</p>
        </main>
      </>
    )
  }

  if (conflicts.length === 0) {
    return (
      <>
        <AppBar title="Sync conflicts" backTo="/settings" />
        <main className={styles.main}>
          <div className={styles.empty}>
            <p className={styles.emptyHeading}>✓ All conflicts resolved</p>
            <p className={styles.muted}>
              Your choices are being pushed to Drive.
            </p>
            <Button onClick={goHome} className={styles.homeButton}>
              Back to home
            </Button>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <AppBar title="Sync conflicts" backTo="/settings" />
      <main className={styles.main}>
        <p className={styles.intro}>
          Two devices edited these items around the same time. Pick which
          version wins for each. Your choice will sync to the other device.
        </p>
        <p className={styles.muted}>
          {conflicts.length} unresolved conflict
          {conflicts.length === 1 ? '' : 's'}
        </p>
        <div className={styles.cards}>
          {conflicts.map((c) => (
            <ConflictCard key={c.id} conflict={c} />
          ))}
        </div>
      </main>
    </>
  )
}
