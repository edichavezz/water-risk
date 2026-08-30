import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  shapeFires,
  centroidOf,
  fireHistoryQueryUrl,
  getFireHistory,
  ARCHIVE_SINCE,
} from './fireHistory'

afterEach(() => vi.unstubAllGlobals())

const ronda = { lat: 36.7429, lng: -5.1664 }

/** A square ring centred on (lng, lat), roughly `deg` across. */
const ring = (lng: number, lat: number, deg = 0.01) => ({
  type: 'Polygon',
  coordinates: [
    [
      [lng - deg, lat - deg],
      [lng + deg, lat - deg],
      [lng + deg, lat + deg],
      [lng - deg, lat + deg],
      [lng - deg, lat - deg],
    ],
  ],
})

const feature = (lng: number, lat: number, props: Record<string, string>) => ({
  properties: props,
  geometry: ring(lng, lat),
})

describe('centroidOf', () => {
  it('averages a polygon ring', () => {
    const c = centroidOf(ring(-5.0, 36.8))
    expect(c!.lng).toBeCloseTo(-5.0, 2)
    expect(c!.lat).toBeCloseTo(36.8, 2)
  })

  it('handles multipolygon nesting', () => {
    const c = centroidOf({ type: 'MultiPolygon', coordinates: [ring(-5.0, 36.8).coordinates] })
    expect(c!.lng).toBeCloseTo(-5.0, 2)
  })

  it('returns null when there is no geometry to average', () => {
    expect(centroidOf(undefined)).toBeNull()
    expect(centroidOf({ type: 'Polygon', coordinates: [] })).toBeNull()
  })
})

describe('shapeFires', () => {
  it('reads date, area, place and distance off the EFFIS attributes', () => {
    const fires = shapeFires(
      [
        feature(-5.2, 36.8, {
          FIREDATE: '2022-08-02 22:35:00',
          AREA_HA: '509',
          COMMUNE: 'Olvera',
          PROVINCE: 'Cádiz',
          PERCNA2K: '12.4',
        }),
      ],
      ronda,
    )

    expect(fires).toHaveLength(1)
    expect(fires[0].date).toBe('2022-08-02')
    expect(fires[0].areaHa).toBe(509)
    expect(fires[0].commune).toBe('Olvera')
    expect(fires[0].protectedPercent).toBe(12)
    expect(fires[0].distanceKm).toBeGreaterThan(0)
    expect(fires[0].distanceKm).toBeLessThan(15)
  })

  it('orders most recent first', () => {
    const fires = shapeFires(
      [
        feature(-5.2, 36.8, { FIREDATE: '2018-07-22 00:00:00', AREA_HA: '123' }),
        feature(-5.2, 36.8, { FIREDATE: '2024-08-19 00:00:00', AREA_HA: '326' }),
        feature(-5.2, 36.8, { FIREDATE: '2020-06-24 00:00:00', AREA_HA: '67' }),
      ],
      ronda,
    )
    expect(fires.map(f => f.date.slice(0, 4))).toEqual(['2024', '2020', '2018'])
  })

  // The query is a bounding box, so its corners reach further than the radius.
  // Distances are recomputed here rather than trusted from the box.
  it('drops burns outside the radius even though the bbox included them', () => {
    const far = shapeFires(
      [feature(-5.1664, 37.2, { FIREDATE: '2023-01-01 00:00:00', AREA_HA: '10' })],
      ronda,
      30,
    )
    expect(far).toHaveLength(0)
  })

  it('skips features with no date rather than inventing one', () => {
    expect(shapeFires([feature(-5.2, 36.8, { AREA_HA: '100' })], ronda)).toHaveLength(0)
  })
})

describe('fireHistoryQueryUrl', () => {
  it('builds a bbox around the point in EPSG:4326', () => {
    const url = fireHistoryQueryUrl(ronda, 30)
    expect(url).toContain('typename=ms:modis.ba.poly')
    expect(url).toContain('outputformat=geojson')
    expect(url).toContain('srsname=EPSG:4326')

    const bbox = new URL(url).searchParams.get('bbox')!.split(',').map(Number)
    expect(bbox[0]).toBeLessThan(ronda.lng)
    expect(bbox[2]).toBeGreaterThan(ronda.lng)
    // ~30 km is a bit over a quarter degree of latitude.
    expect(ronda.lat - bbox[1]).toBeCloseTo(0.27, 1)
  })
})

describe('getFireHistory', () => {
  it('reports an empty archive as a scoped answer, not a gap', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ features: [] }) })))
    const result = await getFireHistory(ronda)
    expect(result.fires).toEqual([])
    expect(result.since).toBe(ARCHIVE_SINCE)
    expect(result.radiusKm).toBe(30)
  })

  it('throws on a failed request so the row can offer a retry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })))
    await expect(getFireHistory(ronda)).rejects.toThrow('503')
  })
})
