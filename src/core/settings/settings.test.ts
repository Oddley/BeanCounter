import { describe, it, expect } from 'vitest'
import {
  setStickyLitter,
  clearStickyLitter,
  hasStickyLitter,
  NullAppSettings,
  type AppSettings,
} from './index'

describe('setStickyLitter', () => {
  it('sets the sticky litter id and bumps lastUpdatedAt', () => {
    const result = setStickyLitter(NullAppSettings, 'L1', 500)
    expect(result.stickyLitterId).toBe('L1')
    expect(result.lastUpdatedAt).toBe(500)
  })

  it('does not mutate the input', () => {
    setStickyLitter(NullAppSettings, 'L1', 500)
    expect(NullAppSettings.stickyLitterId).toBe('')
    expect(NullAppSettings.lastUpdatedAt).toBe(0)
  })

  it('replaces an existing sticky litter', () => {
    const withL1 = setStickyLitter(NullAppSettings, 'L1', 100)
    const withL2 = setStickyLitter(withL1, 'L2', 200)
    expect(withL2.stickyLitterId).toBe('L2')
    expect(withL2.lastUpdatedAt).toBe(200)
  })
})

describe('clearStickyLitter', () => {
  it('removes the sticky litter id and bumps lastUpdatedAt', () => {
    const set = setStickyLitter(NullAppSettings, 'L1', 100)
    const cleared = clearStickyLitter(set, 200)
    expect(cleared.stickyLitterId).toBe('')
    expect(cleared.lastUpdatedAt).toBe(200)
  })

  it('is idempotent in value but bumps lastUpdatedAt', () => {
    const once = clearStickyLitter(NullAppSettings, 100)
    const twice = clearStickyLitter(once, 200)
    expect(twice.stickyLitterId).toBe('')
    expect(twice.lastUpdatedAt).toBe(200)
  })
})

describe('hasStickyLitter', () => {
  it('returns false when no litter is pinned', () => {
    expect(hasStickyLitter(NullAppSettings)).toBe(false)
  })

  it('returns true after setStickyLitter', () => {
    const set = setStickyLitter(NullAppSettings, 'L1', 100)
    expect(hasStickyLitter(set)).toBe(true)
  })

  it('returns false after clearStickyLitter', () => {
    const set = setStickyLitter(NullAppSettings, 'L1', 100)
    expect(hasStickyLitter(clearStickyLitter(set, 200))).toBe(false)
  })
})

describe('NullAppSettings', () => {
  it('has empty stickyLitterId', () => {
    expect(NullAppSettings.stickyLitterId).toBe('')
  })

  it('has lastUpdatedAt of 0', () => {
    expect(NullAppSettings.lastUpdatedAt).toBe(0)
  })

  it('reports no sticky via hasStickyLitter', () => {
    expect(hasStickyLitter(NullAppSettings)).toBe(false)
  })

  it('is consumable by AppSettings functions (Liskov)', () => {
    const result = setStickyLitter(NullAppSettings, 'L1', 100)
    expect(result.stickyLitterId).toBe('L1')
  })

  it('satisfies the AppSettings interface', () => {
    const asSettings: AppSettings = NullAppSettings
    expect(asSettings).toBeDefined()
  })
})
