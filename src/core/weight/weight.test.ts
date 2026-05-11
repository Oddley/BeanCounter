import { describe, it, expect } from 'vitest'
import {
  weightEntryId,
  createWeightEntry,
  validateGrams,
  NullWeightEntry,
  type WeightEntry,
} from './index'

describe('weightEntryId', () => {
  it('produces a deterministic composed id from sessionId + kittenId', () => {
    const id = weightEntryId('S1', 'K1')
    expect(weightEntryId('S1', 'K1')).toBe(id)
  })

  it('produces different ids for different (session, kitten) pairs', () => {
    expect(weightEntryId('S1', 'K1')).not.toBe(weightEntryId('S1', 'K2'))
    expect(weightEntryId('S1', 'K1')).not.toBe(weightEntryId('S2', 'K1'))
  })
})

describe('createWeightEntry', () => {
  it('returns an entry with id composed from sessionId + kittenId', () => {
    const entry = createWeightEntry({
      sessionId: 'S1',
      kittenId: 'K1',
      grams: 120,
      timestamp: 1000,
      clientWriteId: 'W1',
    })
    expect(entry.id).toBe(weightEntryId('S1', 'K1'))
    expect(entry.sessionId).toBe('S1')
    expect(entry.kittenId).toBe('K1')
    expect(entry.grams).toBe(120)
    expect(entry.timestamp).toBe(1000)
    expect(entry.clientWriteId).toBe('W1')
  })

  it('does not validate grams (caller is responsible)', () => {
    const entry = createWeightEntry({
      sessionId: 'S1',
      kittenId: 'K1',
      grams: -1,
      timestamp: 0,
      clientWriteId: 'W1',
    })
    expect(entry.grams).toBe(-1)
  })
})

describe('validateGrams', () => {
  it('accepts a positive integer in normal kitten range', () => {
    expect(validateGrams(120).valid).toBe(true)
    expect(validateGrams(500).valid).toBe(true)
    expect(validateGrams(1).valid).toBe(true)
  })

  it('accepts the upper-bound sanity cap of 5000', () => {
    expect(validateGrams(5000).valid).toBe(true)
  })

  it('rejects zero', () => {
    expect(validateGrams(0).valid).toBe(false)
  })

  it('rejects negative numbers', () => {
    expect(validateGrams(-1).valid).toBe(false)
    expect(validateGrams(-100).valid).toBe(false)
  })

  it('rejects values above the sanity cap', () => {
    expect(validateGrams(5001).valid).toBe(false)
    expect(validateGrams(100000).valid).toBe(false)
  })

  it('rejects non-integers', () => {
    expect(validateGrams(120.5).valid).toBe(false)
    expect(validateGrams(0.1).valid).toBe(false)
  })

  it('rejects NaN', () => {
    expect(validateGrams(NaN).valid).toBe(false)
  })

  it('rejects Infinity', () => {
    expect(validateGrams(Infinity).valid).toBe(false)
    expect(validateGrams(-Infinity).valid).toBe(false)
  })
})

describe('NullWeightEntry', () => {
  it('has empty id', () => {
    expect(NullWeightEntry.id).toBe('')
  })

  it('has empty sessionId and kittenId', () => {
    expect(NullWeightEntry.sessionId).toBe('')
    expect(NullWeightEntry.kittenId).toBe('')
  })

  it('has zero grams', () => {
    expect(NullWeightEntry.grams).toBe(0)
  })

  it('has zero timestamp', () => {
    expect(NullWeightEntry.timestamp).toBe(0)
  })

  it('has empty clientWriteId', () => {
    expect(NullWeightEntry.clientWriteId).toBe('')
  })

  it('satisfies the WeightEntry interface', () => {
    const asEntry: WeightEntry = NullWeightEntry
    expect(asEntry).toBeDefined()
  })

  it('is detectable via empty id (not via grams)', () => {
    // A real entry could theoretically have grams=0 (invalid but possible);
    // consumers should detect "no entry" via id, not value.
    expect(NullWeightEntry.id).toBe('')
  })
})
