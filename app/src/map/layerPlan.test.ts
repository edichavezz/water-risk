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
    const v = visibleLayerIds('groundwater', ['reservoirs'])
    expect(v.has('groundwater-fill')).toBe(true)
    expect(v.has('reservoirs-circle')).toBe(true)
  })
})
