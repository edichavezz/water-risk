import { describe, it, expect } from 'vitest'
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import type maplibregl from 'maplibre-gl'
import { ensureDataLayers } from './dataLayers'
import { DATASET_MAP_LAYERS } from './layerPlan'

/**
 * MapLibre validates every layer it is handed and *silently skips* the ones
 * that fail — `addLayer` logs to the console and returns, so a bad paint
 * expression makes a whole dataset vanish from the map with nothing in the UI
 * to show for it. That is exactly how the reservoir markers disappeared: three
 * zoom-based `interpolate`s nested inside one `case`, which the spec forbids.
 *
 * So run every layer this app adds through the same validator MapLibre uses,
 * rather than trusting that they load.
 */
function collectStyle() {
  const sources: Record<string, unknown> = {}
  const layers: unknown[] = []
  const map = {
    getSource: (id: string) => sources[id],
    addSource: (id: string, spec: unknown) => { sources[id] = spec },
    addLayer: (spec: unknown) => { layers.push(spec) },
    getLayer: () => undefined,
    on: () => {},
  }
  ensureDataLayers(map as unknown as maplibregl.Map)
  return { version: 8 as const, sources, layers }
}

describe('dataset map layers', () => {
  const style = collectStyle()

  it('are all accepted by the MapLibre style validator', () => {
    const errors = validateStyleMin(style as never)
      .map(e => `${e.message}`)
    expect(errors).toEqual([])
  })

  it('add every layer the layer plan expects to toggle', () => {
    const added = new Set(style.layers.map(l => (l as { id: string }).id))
    // A layer the plan can name but the map never added is a dead toggle.
    for (const [dataset, ids] of Object.entries(DATASET_MAP_LAYERS)) {
      for (const id of ids) {
        expect(added, `${dataset} → ${id}`).toContain(id)
      }
    }
  })
})
