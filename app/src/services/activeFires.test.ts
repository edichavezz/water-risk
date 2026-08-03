import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  decodeDetectionTile,
  filterRecentDetections,
  getRecentFireDetections,
  gibsTileCoordinates,
} from './activeFires'

afterEach(() => vi.unstubAllGlobals())

const bordeaux = { lat: 44.8378, lng: -0.5792 }

// Captured from NASA GIBS for NOAA-20 VIIRS on 2026-08-02. Keeping a tiny
// binary fixture exercises the real MVT field names without a network test.
const MVT_BASE64 =
  'GucCCi5WSUlSU19OT0FBMjBfVGhlcm1hbF9Bbm9tYWxpZXNfMzc1bV9BbGxfdjJfTlJUEicSHAAAAQECAgMDBAQFBQYGBwcICAkJCgoLCwwMDQ0YASIFCfIPqj4aCExBVElUVURFGglMT05HSVRVREUaCkJSSUdIVF9USTQaBFNDQU4aBVRSQUNLGghBQ1FfREFURRoIQUNRX1RJTUUaCVNBVEVMTElURRoKQ09ORklERU5DRRoHVkVSU0lPThoKQlJJR0hUX1RJNRoDRlJQGghEQVlOSUdIVBoDVUlEIgkZpKXydoRnRUAiCRkCnx9GCA/7vyIJGRSuR+F6/HRAIgkZXI/C9Shc3z8iCRmamZmZmZnZPyIMCgoyMDI2LTA4LTAyIgcKBTEyOjQ0IgUKA04yMCIFCgNsb3ciCAoGMi4wTlJUIgkZcT0K16NAc0AiCRn2KFyPwvUGQCIDCgFEIgQgvPgBKIAgeAI='

describe('NASA GIBS detection tiles', () => {
  it('selects only the geographic tiles intersecting the search radius', () => {
    expect(gibsTileCoordinates(bordeaux, 30)).toEqual([
      { row: 19, col: 79 },
      { row: 20, col: 79 },
    ])
  })

  it('decodes the official acquisition timestamp and detection attributes', () => {
    const bytes = Uint8Array.from(atob(MVT_BASE64), c => c.charCodeAt(0))
    const detections = decodeDetectionTile(bytes.buffer)
    expect(detections).toHaveLength(1)
    expect(detections[0]).toMatchObject({
      detectedAt: '2026-08-02T12:44:00Z',
      lat: 42.80873,
      lng: -1.69117,
      confidence: 'low',
      satellite: 'NOAA-20',
    })
  })

  it('keeps only presumed vegetation-fire detections inside 30 km and 24 hours', () => {
    const detections = filterRecentDetections([
      { id: 'keep', detectedAt: '2026-08-03T11:00:00Z', lat: 44.84, lng: -0.58, distanceKm: 0, confidence: 'nominal', satellite: 'NOAA-20', type: 'vegetation' },
      { id: 'old', detectedAt: '2026-08-02T11:59:59Z', lat: 44.84, lng: -0.58, distanceKm: 0, confidence: 'high', satellite: 'NOAA-20', type: 'vegetation' },
      { id: 'far', detectedAt: '2026-08-03T11:00:00Z', lat: 45.5, lng: -0.58, distanceKm: 0, confidence: 'high', satellite: 'NOAA-20', type: 'vegetation' },
      { id: 'static', detectedAt: '2026-08-03T11:00:00Z', lat: 44.84, lng: -0.58, distanceKm: 0, confidence: 'high', satellite: 'NOAA-20', type: 'other' },
      { id: 'keep', detectedAt: '2026-08-03T11:00:00Z', lat: 44.84, lng: -0.58, distanceKm: 0, confidence: 'nominal', satellite: 'NOAA-20', type: 'vegetation' },
    ], bordeaux, 30, new Date('2026-08-03T12:00:00Z'))
    expect(detections).toHaveLength(1)
    expect(detections[0].id).toBe('keep')
    expect(detections[0].distanceKm).toBeLessThan(1)
  })

  it('wraps tiles and distances across the antimeridian', () => {
    const centre = { lat: 0, lng: 179.9 }
    expect(gibsTileCoordinates(centre, 30)).toEqual([
      { row: 39, col: 159 }, { row: 39, col: 0 },
      { row: 40, col: 159 }, { row: 40, col: 0 },
    ])
    const detections = filterRecentDetections([{
      id: 'across', detectedAt: '2026-08-03T11:00:00Z',
      lat: 0, lng: -179.95, distanceKm: 0,
      confidence: 'high', satellite: 'NOAA-20', type: 'vegetation',
    }], centre, 30, new Date('2026-08-03T12:00:00Z'))
    expect(detections).toHaveLength(1)
    expect(detections[0].distanceKm).toBeLessThan(20)
  })

  it('does not turn a failed feed into zero detections', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })))
    await expect(
      getRecentFireDetections(bordeaux, new Date('2026-08-03T12:00:00Z')),
    ).rejects.toThrow('503')
  })
})
