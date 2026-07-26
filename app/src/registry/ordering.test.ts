import { describe, it, expect } from 'vitest'
import { hasResult, rankByAvailability } from './ordering'
import type { DatasetDef } from './datasets'
import type { DatasetId, DatasetResult } from '../types/workspace'

const defs = (['flood', 'drought', 'reservoirs', 'waterQuality'] as DatasetId[])
  .map(id => ({ id }) as DatasetDef)

const ids = (list: DatasetDef[]) => list.map(d => d.id)

describe('rankByAvailability', () => {
  it('puts rows carrying a value above rows that have none', () => {
    const out = rankByAvailability(defs, {
      flood: { status: 'unavailable' },
      drought: { status: 'available', data: {} },
      reservoirs: { status: 'error', error: 'timeout' },
      waterQuality: { status: 'available', data: {} },
    })
    expect(ids(out)).toEqual(['drought', 'waterQuality', 'reservoirs', 'flood'])
  })

  it('keeps relevance order inside a rank', () => {
    const out = rankByAvailability(defs, {
      flood: { status: 'available', data: {} },
      drought: { status: 'available', data: {} },
      reservoirs: { status: 'unavailable' },
      waterQuality: { status: 'unsupported' },
    })
    expect(ids(out)).toEqual(['flood', 'drought', 'reservoirs', 'waterQuality'])
  })

  it('leaves an all-loading list in relevance order', () => {
    expect(ids(rankByAvailability(defs, {}))).toEqual(ids(defs))
  })

  it('never lets a row overtake one above it that still has a value', () => {
    // The property the shared available/loading rank exists to guarantee. Rows
    // do shift up a slot when something above them drops away — that is
    // unavoidable. What must never happen is a row climbing *past* a row that
    // did not lose anything, which is what makes a loading list churn.
    const sequence: Array<Partial<Record<DatasetId, DatasetResult>>> = [
      {},
      { flood: { status: 'unavailable' } },
      { flood: { status: 'unavailable' }, drought: { status: 'available', data: {} } },
      {
        flood: { status: 'unavailable' },
        drought: { status: 'available', data: {} },
        reservoirs: { status: 'error', error: 'boom' },
      },
      {
        flood: { status: 'unavailable' },
        drought: { status: 'available', data: {} },
        reservoirs: { status: 'error', error: 'boom' },
        waterQuality: { status: 'available', data: {} },
      },
    ]

    let previous = { order: ids(rankByAvailability(defs, sequence[0])), results: sequence[0] }
    for (const results of sequence.slice(1)) {
      const order = ids(rankByAvailability(defs, results))
      for (const above of order) {
        for (const below of order) {
          const overtook =
            previous.order.indexOf(above) < previous.order.indexOf(below) &&
            order.indexOf(below) < order.indexOf(above)
          if (overtook) {
            // Only legitimate if the row that got passed lost its value.
            expect(hasResult(previous.results[above])).toBe(true)
            expect(hasResult(results[above])).toBe(false)
          }
        }
      }
      previous = { order, results }
    }
  })
})
