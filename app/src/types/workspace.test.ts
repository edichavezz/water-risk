import { describe, it, expect } from 'vitest'
import { isRenderableValue, NON_SAFE_STATUSES, ALL_DATASET_IDS } from './workspace'

describe('normalized dataset states', () => {
  it('only available is a renderable value', () => {
    expect(isRenderableValue({ status: 'available', data: 1 })).toBe(true)
    for (const status of ['loading', 'unavailable', 'not_applicable', 'unsupported', 'error'] as const) {
      expect(isRenderableValue({ status })).toBe(false)
    }
    expect(isRenderableValue(undefined)).toBe(false)
  })

  it('unavailable, unsupported and error are non-safe states', () => {
    expect(NON_SAFE_STATUSES).toEqual(['unavailable', 'unsupported', 'error'])
  })

  it('registers every dataset in the union', () => {
    expect(ALL_DATASET_IDS).toHaveLength(11)
  })
})
