import { describe, expect, it, vi } from 'vitest'
import type maplibregl from 'maplibre-gl'
import type { FireHistoryResult } from '../types'
import { updateFireHistorySource } from './dataLayers'

describe('historic-fire map source', () => {
  it('uses the exact perimeters already returned to the panel', () => {
    const setData = vi.fn()
    const map = { getSource: () => ({ setData }) } as unknown as maplibregl.Map
    const result: FireHistoryResult = {
      fires: [], radiusKm: 30, since: 2012, source: 'Copernicus EFFIS',
      perimeters: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature', properties: { FIREDATE: '2026-07-29' },
          geometry: { type: 'Point', coordinates: [-0.58, 44.84] },
        }],
      },
    }

    updateFireHistorySource(map, result)
    expect(setData).toHaveBeenCalledWith(result.perimeters)
  })

  it('clears stale perimeters while a new search has no result', () => {
    const setData = vi.fn()
    const map = { getSource: () => ({ setData }) } as unknown as maplibregl.Map
    updateFireHistorySource(map, null)
    expect(setData).toHaveBeenCalledWith({ type: 'FeatureCollection', features: [] })
  })
})
