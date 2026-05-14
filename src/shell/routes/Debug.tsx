import { useNavigate } from 'react-router-dom'
import { AppBar, Button } from '../components'
import {
  useAllLitters,
  useAllKittens,
  useAllSessions,
  useAllWeightEntries,
  useSettings,
  wipeAllData,
  db,
} from '../db'
import { newId } from '../../core/ids'
import { createLitter } from '../../core/litter'
import { createKitten } from '../../core/kitten'
import {
  createSession,
  completeSession,
  type FeedingSession,
} from '../../core/session'
import { createWeightEntry, type WeightEntry } from '../../core/weight'
import styles from './Debug.module.css'

const SEED_TIMESTAMPS = [
  '9:14 AM 5/3/2026',
  '12:16 PM 5/3/2026',
  '3:27 PM 5/3/2026',
  '6:25 PM 5/3/2026',
  '10:36 PM 5/3/2026',
  '12:48 AM 5/4/2026',
  '3:41 AM 5/4/2026',
  '6:58 AM 5/4/2026',
  '9:34 AM 5/4/2026',
  '12:39 PM 5/4/2026',
  '3:43 PM 5/4/2026',
  '6:08 PM 5/4/2026',
  '9:25 PM 5/4/2026',
  '11:51 PM 5/4/2026',
  '3:05 AM 5/5/2026',
  '6:04 AM 5/5/2026',
  '9:07 AM 5/5/2026',
  '12:37 PM 5/5/2026',
  '3:33 PM 5/5/2026',
  '6:50 PM 5/5/2026',
  '9:22 PM 5/5/2026',
  '12:27 AM 5/6/2026',
  '3:10 AM 5/6/2026',
  '6:37 AM 5/6/2026',
  '10:20 AM 5/6/2026',
  '1:20 PM 5/6/2026',
]

const SEED_WEIGHTS = [
  107, 108, 108, 108, 106, 108, 110, 112, 112, 113, 118, 119, 119, 121, 119,
  120, 121, 122, 123, 123, 123, 127, 128, 131, 131, 130,
]

const SEED_KITTEN_NAMES = ['Sage', 'Basil', 'Thyme', 'Pepper']

function parseSeedTimestamp(s: string): number {
  const m = s.trim().match(/^(\d+):(\d+)\s+(AM|PM)\s+(\d+)\/(\d+)\/(\d+)$/i)
  if (!m) return 0
  const hhStr = m[1]
  const mmStr = m[2]
  const ampm = m[3]
  const monthStr = m[4]
  const dayStr = m[5]
  const yearStr = m[6]
  if (
    hhStr === undefined ||
    mmStr === undefined ||
    ampm === undefined ||
    monthStr === undefined ||
    dayStr === undefined ||
    yearStr === undefined
  ) {
    return 0
  }
  let hour = parseInt(hhStr, 10)
  if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12
  if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0
  return new Date(
    parseInt(yearStr, 10),
    parseInt(monthStr, 10) - 1,
    parseInt(dayStr, 10),
    hour,
    parseInt(mmStr, 10),
    0,
  ).getTime()
}

function variantWeight(baseGrams: number, kittenIndex: number): number {
  switch (kittenIndex) {
    case 0:
      return baseGrams
    case 1:
      return baseGrams + 12
    case 2:
      return baseGrams - 8
    case 3:
      return Math.round(baseGrams * 0.85)
    default:
      return baseGrams
  }
}

async function seedDemoLitter(): Promise<string> {
  const now = Date.now()
  const litterId = newId()
  const litter = createLitter({ id: litterId, name: 'Demo (Seeded)', now })

  const kittens = SEED_KITTEN_NAMES.map((name, i) =>
    createKitten({
      id: newId(),
      litterId,
      displayName: name,
      order: i,
      now,
    }),
  )

  const sessions: FeedingSession[] = []
  const entries: WeightEntry[] = []

  for (let i = 0; i < SEED_TIMESTAMPS.length; i++) {
    const rawTs = SEED_TIMESTAMPS[i]
    const rawBase = SEED_WEIGHTS[i]
    if (rawTs === undefined || rawBase === undefined) continue
    const ts = parseSeedTimestamp(rawTs)
    if (ts === 0) continue
    const session = completeSession(
      createSession({ id: newId(), litterId, createdAt: ts }),
    )
    sessions.push(session)

    for (let k = 0; k < kittens.length; k++) {
      const kitten = kittens[k]
      if (kitten === undefined) continue
      entries.push(
        createWeightEntry({
          sessionId: session.id,
          kittenId: kitten.id,
          grams: variantWeight(rawBase, k),
          timestamp: ts,
          clientWriteId: newId(),
        }),
      )
    }
  }

  await db.transaction(
    'rw',
    [db.litters, db.kittens, db.feedingSessions, db.weightEntries],
    async () => {
      await db.litters.add(litter)
      await db.kittens.bulkAdd(kittens)
      await db.feedingSessions.bulkAdd(sessions)
      await db.weightEntries.bulkAdd(entries)
    },
  )

  return litterId
}

export function Debug() {
  const navigate = useNavigate()
  const litters = useAllLitters() ?? []
  const kittens = useAllKittens() ?? []
  const sessions = useAllSessions() ?? []
  const weightEntries = useAllWeightEntries() ?? []
  const settings = useSettings()

  const dump = {
    settings,
    litters,
    kittens,
    sessions,
    weightEntries,
  }

  const handleWipe = async () => {
    const ok = window.confirm(
      'Wipe all litters, kittens, and settings? This cannot be undone.',
    )
    if (!ok) return
    await wipeAllData()
    navigate('/', { replace: true })
  }

  const handleSeed = async () => {
    const ok = window.confirm(
      'Add a 4-kitten demo litter ("Demo (Seeded)") with 26 weighings spanning 5/3–5/6/2026?',
    )
    if (!ok) return
    const litterId = await seedDemoLitter()
    navigate(`/litters/${litterId}/graph`)
  }

  return (
    <>
      <AppBar title="Debug" backTo="/" />
      <main className={styles.main}>
        <pre className={styles.pre}>{JSON.stringify(dump, null, 2)}</pre>
        <div className={styles.seed}>
          <Button variant="secondary" onClick={handleSeed}>
            Seed demo litter
          </Button>
        </div>
        <div className={styles.danger}>
          <Button variant="danger" onClick={handleWipe}>
            Wipe all data
          </Button>
        </div>
      </main>
    </>
  )
}
