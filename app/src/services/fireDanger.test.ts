import { describe, it, expect, vi, afterEach } from 'vitest'
import { FIRE_DANGER_PALETTE, getFireDangerWmsUrl, getFireDanger } from './fireDanger'
import { nearestColour } from './wmsSample'
import * as wmsSample from './wmsSample'

afterEach(() => vi.restoreAllMocks())

const ronda = { lat: 36.7429, lng: -5.1664 }

describe('the FWI palette', () => {
  it('covers all six published danger classes', () => {
    expect(FIRE_DANGER_PALETTE.map(p => p.value)).toEqual([
      'low', 'moderate', 'high', 'very_high', 'extreme', 'very_extreme',
    ])
  })

  // The classes must stay far enough apart in RGB that a rendered pixel maps
  // to exactly one of them. If a future legend change bunches two together,
  // classification silently starts guessing.
  it('keeps every class distinguishable at the default tolerance', () => {
    for (const { rgb, value } of FIRE_DANGER_PALETTE) {
      const px = { r: rgb[0], g: rgb[1], b: rgb[2], a: 255 }
      expect(nearestColour(px, FIRE_DANGER_PALETTE)).toBe(value)
    }
  })

  it('refuses a colour that is not on the palette', () => {
    // Mid-blue appears nowhere in a fire-danger ramp.
    expect(nearestColour({ r: 20, g: 60, b: 200, a: 255 }, FIRE_DANGER_PALETTE)).toBeNull()
  })
})

describe('getFireDangerWmsUrl', () => {
  it('requests the 0.07-degree layer, which is the one carrying data', () => {
    const url = getFireDangerWmsUrl('2026-08-03')
    expect(url).toContain('LAYERS=ecmwf007.fwi')
    // ecmwf.fwi.fwi is advertised but returns an empty raster at every date.
    expect(url).not.toContain('LAYERS=ecmwf.fwi.fwi')
    expect(url).toContain('{bbox-epsg-3857}')
  })

  it('requests the exact forecast day instead of accepting the service default', () => {
    expect(getFireDangerWmsUrl('2026-08-03')).toContain('TIME=2026-08-03')
  })
})

describe('getFireDanger', () => {
  it('classifies a painted pixel against the published legend', async () => {
    vi.spyOn(wmsSample, 'samplePixel').mockResolvedValue({ r: 231, g: 117, b: 0, a: 255 })
    const result = await getFireDanger(ronda, '2026-08-03')
    expect(result.danger).toBe('very_high')
    expect(result.forDate).toBe('2026-08-03')
    expect(result.source).toBe('Copernicus EFFIS')
    expect(wmsSample.samplePixel).toHaveBeenCalledWith(expect.stringContaining('TIME=2026-08-03'))
  })

  it('treats an unpainted pixel as no forecast rather than low danger', async () => {
    vi.spyOn(wmsSample, 'samplePixel').mockResolvedValue({ r: 0, g: 0, b: 0, a: 0 })
    expect((await getFireDanger(ronda, '2026-08-03')).danger).toBe('unknown')
  })

  // A dead upstream must never read as "low danger" — that is the whole
  // missing-data-never-looks-safe rule, and this is a hazard layer.
  it('reports unknown when the service fails', async () => {
    vi.spyOn(wmsSample, 'samplePixel').mockRejectedValue(new Error('gateway'))
    expect((await getFireDanger(ronda, '2026-08-03')).danger).toBe('unknown')
  })
})
