import Dexie, { type Table } from 'dexie'
import { type Litter } from '../../core/litter'
import { type Kitten } from '../../core/kitten'
import { type AppSettings, NullAppSettings } from '../../core/settings'

export interface SettingsRecord extends AppSettings {
  readonly id: 'singleton'
}

export const SETTINGS_SINGLETON_ID = 'singleton' as const

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

    this.on('populate', () => {
      this.settings.add({ ...NullAppSettings, id: SETTINGS_SINGLETON_ID })
    })
  }
}

export const db = new BeanCounterDB()
