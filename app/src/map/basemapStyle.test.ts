import { describe, it, expect } from 'vitest'
import { quietFocusTransform } from './basemapStyle'

const style = {
  version: 8 as const, sources: {}, layers: [
    { id: 'water', type: 'fill' as const },
    { id: 'poi_label', type: 'symbol' as const },
    { id: 'poi-level-1', type: 'symbol' as const },
    { id: 'place_city', type: 'symbol' as const },
    { id: 'boundary_state', type: 'line' as const },
  ],
}

describe('quiet focus basemap transform', () => {
  it('removes POI layers', () => {
    const out = quietFocusTransform(style as never)
    expect(out.layers.map(l => l.id)).toEqual(['water', 'place_city', 'boundary_state'])
  })
  it('keeps water, places and boundaries untouched', () => {
    const out = quietFocusTransform(style as never)
    expect(out.layers.find(l => l.id === 'water')).toEqual({ id: 'water', type: 'fill' })
  })
})
