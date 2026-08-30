import { describe, expect, it, vi } from 'vitest'
import type maplibregl from 'maplibre-gl'
import { updateFireDangerSource } from './dataLayers'

describe('fire-danger map source', () => {
  it('uses the exact forecast date carried by the sampled result', () => {
    const setTiles = vi.fn()
    const map = { getSource: () => ({ setTiles }) } as unknown as maplibregl.Map
    updateFireDangerSource(map, {
      danger: 'high', forDate: '2026-08-04', source: 'Copernicus EFFIS',
    })
    expect(setTiles).toHaveBeenCalledWith([
      expect.stringContaining('TIME=2026-08-04'),
    ])
  })
})
