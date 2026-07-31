import { describe, it, expect } from 'vitest'
import { visibleLayerIds, DATASET_MAP_LAYERS } from './layerPlan'

describe('layer plan', () => {
  it('no primary layer -> only context layers visible', () => {
    const v = visibleLayerIds(null, ['reservoirs'])
    expect(v).toEqual(new Set(DATASET_MAP_LAYERS.reservoirs))
  })
  it('exactly one primary at a time', () => {
    const v = visibleLayerIds('flood', [])
    expect(v).toEqual(new Set(DATASET_MAP_LAYERS.flood))
    const w = visibleLayerIds('drought', [])
    expect([...w].some(id => id.startsWith('flood'))).toBe(false)
  })
  it('panel-only datasets contribute no layers', () => {
    expect(DATASET_MAP_LAYERS.waterQuality).toEqual([])
    expect(DATASET_MAP_LAYERS.bathingWater).toEqual([])
  })
  it('primary plus contexts combine', () => {
    const v = visibleLayerIds('coastalFlood', ['reservoirs'])
    expect(v.has('coastal-tramos')).toBe(true)
    expect(v.has('reservoirs-circle')).toBe(true)
  })

  it('groundwater contributes no layers — its geometry was fabricated', () => {
    // The four polygons this drew were hand-drawn rectangles standing in for
    // IGME units, three of them outside Andalucía, so the map was asserting
    // boundaries that do not exist. See services/groundwater.ts.
    expect(DATASET_MAP_LAYERS.groundwater).toEqual([])
    expect(visibleLayerIds('groundwater', []).size).toBe(0)
  })
})
