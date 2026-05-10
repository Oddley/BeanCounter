import { describe, it, expect } from 'vitest'
import {
  setStickyLitter,
  clearStickyLitter,
  hasStickyLitter,
  NullAppSettings,
  type AppSettings,
} from './index'

describe('setStickyLitter', () => {
  it('sets the sticky litter id', () => {
    const result = setStickyLitter(NullAppSettings, 'L1')
    expect(result.stickyLitterId).toBe('L1')
  })

  it('does not mutate the input', () => {
    setStickyLitter(NullAppSettings, 'L1')
    expect(NullAppSettings.stickyLitterId).toBe('')
  })

  it('replaces an existing sticky litter', () => {
    const withL1 = setStickyLitter(NullAppSettings, 'L1')
    const withL2 = setStickyLitter(withL1, 'L2')
    expect(withL2.stickyLitterId).toBe('L2')
  })
})

describe('clearStickyLitter', () => {
  it('removes the sticky litter id', () => {
    const set = setStickyLitter(NullAppSettings, 'L1')
    expect(clearStickyLitter(set).stickyLitterId).toBe('')
  })

  it('is idempotent', () => {
    const cleared = clearStickyLitter(NullAppSettings)
    expect(clearStickyLitter(cleared)).toEqual(cleared)
  })
})

describe('hasStickyLitter', () => {
  it('returns false when no litter is pinned', () => {
    expect(hasStickyLitter(NullAppSettings)).toBe(false)
  })

  it('returns true after setStickyLitter', () => {
    const set = setStickyLitter(NullAppSettings, 'L1')
    expect(hasStickyLitter(set)).toBe(true)
  })

  it('returns false after clearStickyLitter', () => {
    const set = setStickyLitter(NullAppSettings, 'L1')
    expect(hasStickyLitter(clearStickyLitter(set))).toBe(false)
  })
})

describe('NullAppSettings', () => {
  it('has empty stickyLitterId', () => {
    expect(NullAppSettings.stickyLitterId).toBe('')
  })

  it('reports no sticky via hasStickyLitter', () => {
    expect(hasStickyLitter(NullAppSettings)).toBe(false)
  })

  it('is consumable by AppSettings functions (Liskov)', () => {
    const result = setStickyLitter(NullAppSettings, 'L1')
    expect(result.stickyLitterId).toBe('L1')
  })

  it('satisfies the AppSettings interface', () => {
    const asSettings: AppSettings = NullAppSettings
    expect(asSettings).toBeDefined()
  })
})
