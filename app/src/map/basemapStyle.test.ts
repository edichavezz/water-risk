import { describe, it, expect } from 'vitest'
import { quietFocusTransform } from './basemapStyle'

const style = {
  version: 8 as const, sources: {}, layers: [
    { id: 'background', type: 'background' as const, paint: { 'background-color': '#fafaf8' } },
    { id: 'water', type: 'fill' as const, paint: { 'fill-color': '#C6E3F0' } },
    { id: 'waterway', type: 'line' as const, paint: { 'line-color': '#C6E3F0' } },
    { id: 'poi_label', type: 'symbol' as const },
    { id: 'poi-level-1', type: 'symbol' as const },
    { id: 'place_city', type: 'symbol' as const, paint: { 'text-color': '#333' } },
    { id: 'boundary_state', type: 'line' as const, paint: { 'line-color': '#9e9cab' } },
  ],
}

describe('quiet focus basemap transform', () => {
  it('removes POI layers', () => {
    const out = quietFocusTransform(style as never)
    expect(out.layers.map(l => l.id)).toEqual([
      'background', 'water', 'waterway', 'place_city', 'boundary_state',
    ])
  })

  it('warms the land and pulls water toward the app palette', () => {
    const out = quietFocusTransform(style as never)
    const paint = (id: string) =>
      out.layers.find(l => l.id === id)?.paint as Record<string, string>

    expect(paint('background')['background-color']).toBe('#F4EDE0')
    expect(paint('water')['fill-color']).toBe('#C8DFE6')
    expect(paint('waterway')['line-color']).toBe('#9FC3CC')
  })

  it('mutes label ink and gives it a warm halo', () => {
    const out = quietFocusTransform(style as never)
    const paint = out.layers.find(l => l.id === 'place_city')?.paint as Record<string, string>

    expect(paint['text-color']).toBe('#5C6B72')
    expect(paint['text-halo-color']).toBe('#FBF8F2')
  })

  it('only writes paint properties the layer type can carry', () => {
    const out = quietFocusTransform(style as never)
    // `water` matches a rule carrying both a fill and a line colour; a fill
    // layer must not come back with `line-color` or MapLibre rejects the style.
    expect(out.layers.find(l => l.id === 'water')?.paint).not.toHaveProperty('line-color')
  })

  it('leaves layers no rule matches alone', () => {
    const out = quietFocusTransform({
      ...style,
      layers: [{ id: 'ferry_route', type: 'line' as const, paint: { 'line-color': '#abc' } }],
    } as never)
    expect(out.layers[0].paint).toEqual({ 'line-color': '#abc' })
  })
})
