import { describe, expect, it, vi } from 'vitest'
import type maplibregl from 'maplibre-gl'
import type { FireHistoryResult } from '../types'
import { updateActiveFireSource, updateFireHistorySource } from './dataLayers'

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

describe('recent-detection map source', () => {
  it('updates whenever the source exists, even while the overall style is loading', () => {
    const setData = vi.fn()
    const map = {
      isStyleLoaded: () => false,
      getSource: (id: string) => id === 'active-fire-src' ? { setData } : undefined,
    } as unknown as maplibregl.Map
    updateActiveFireSource(map, {
      detections: [{
        id: 'one', detectedAt: '2026-08-03T11:00:00Z',
        lat: 44.84, lng: -0.58, distanceKm: 2,
        confidence: 'high', satellite: 'NOAA-20', type: 'vegetation',
      }],
      radiusKm: 30, windowHours: 24,
      through: '2026-08-03T12:00:00Z', source: 'NASA FIRMS',
    })
    expect(setData).toHaveBeenCalledWith(expect.objectContaining({
      type: 'FeatureCollection',
      features: [expect.objectContaining({ id: 'one' })],
    }))
  })
})
