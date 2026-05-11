import Dexie, { type Table, type Transaction } from 'dexie'
import { type Litter } from '../../core/litter'
import { type Kitten } from '../../core/kitten'
import { type AppSettings, NullAppSettings } from '../../core/settings'

export interface SettingsRecord extends AppSettings {
  readonly id: 'singleton'
}

export const SETTINGS_SINGLETON_ID = 'singleton' as const

interface LegacyKittenV1 {
  id: string
  displayName: string
  active: boolean
  litterId: string
}

export class BeanCounterDB extends Dexie {
  litters!: Table<Litter, string>
  kittens!: Table<Kitten, string>
  settings!: Table<SettingsRecord, 'singleton'>

  constructor() {
    super('beancounter')

    this.version(1).stores({
      litters: 'id',
      kittens: 'id, litterId',
      settings: 'id',
    })

    this.version(2)
      .stores({
        litters: 'id',
        kittens: 'id, litterId',
        settings: 'id',
      })
      .upgrade(backfillKittenOrder)

    this.on('populate', () => {
      this.settings.add({ ...NullAppSettings, id: SETTINGS_SINGLETON_ID })
    })
  }
}

async function backfillKittenOrder(tx: Transaction): Promise<void> {
  const kittens = (await tx
    .table('kittens')
    .toArray()) as LegacyKittenV1[]
  const byLitter = new Map<string, LegacyKittenV1[]>()
  for (const k of kittens) {
    const group = byLitter.get(k.litterId) ?? []
    group.push(k)
    byLitter.set(k.litterId, group)
  }
  const updated: Kitten[] = []
  for (const group of byLitter.values()) {
    group.sort((a, b) => a.id.localeCompare(b.id))
    for (let i = 0; i < group.length; i++) {
      const k = group[i]
      if (k === undefined) continue
      updated.push({
        id: k.id,
        displayName: k.displayName,
        active: k.active,
        litterId: k.litterId,
        order: i,
      })
    }
  }
  if (updated.length > 0) {
    await tx.table('kittens').bulkPut(updated)
  }
}

export const db = new BeanCounterDB()
