import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPickResolver, hitsInteractiveLayer } from './pickLocation'
import * as geocoding from '../services/geocoding'

vi.mock('../services/geocoding')

const ecija = {
  displayName: 'Écija, Sevilla', coordinates: { lat: 37.54, lng: -5.08 },
  municipality: 'Écija', countryCode: 'es', provinceName: 'Sevilla', basin: { id: 'ES050', name: 'Guadalquivir' },
}
const madrid = {
  displayName: 'Madrid', coordinates: { lat: 40.42, lng: -3.7 },
  municipality: 'Madrid', provinceName: 'Madrid',
}

beforeEach(() => vi.resetAllMocks())

describe('hitsInteractiveLayer', () => {
  // Only answers with features when asked about a layer that exists, so a
  // drifted or empty layer id fails the tests below rather than passing them.
  const fakeMap = (present: string[], features: unknown[]) => {
    const queried: string[][] = []
    const map = {
      getLayer: (id: string) => (present.includes(id) ? {} : undefined),
      queryRenderedFeatures: (_p: unknown, opts: { layers: string[] }) => {
        queried.push(opts.layers)
        return opts.layers.length > 0 ? features : []
      },
    }
    return { map: map as never, queried }
  }

  // Without this guard a click on a reservoir circle would fire both the
  // reservoir handler and the picker — MapLibre suppresses neither.
  it('is true when a clickable data feature is under the pointer', () => {
    const { map } = fakeMap(['reservoirs-circle'], [{ id: 1 }])
    expect(hitsInteractiveLayer(map, { x: 10, y: 10 })).toBe(true)
  })

  it('queries the reservoir layer by name', () => {
    const { map, queried } = fakeMap(['reservoirs-circle'], [{ id: 1 }])
    hitsInteractiveLayer(map, { x: 10, y: 10 })
    expect(queried).toEqual([['reservoirs-circle']])
  })

  it('is false over bare basemap', () => {
    const { map } = fakeMap(['reservoirs-circle'], [])
    expect(hitsInteractiveLayer(map, { x: 10, y: 10 })).toBe(false)
  })

  it('is false before the data layers have been added', () => {
    const { map } = fakeMap([], [{ id: 1 }])
    expect(hitsInteractiveLayer(map, { x: 10, y: 10 })).toBe(false)
  })
})

describe('pick resolver', () => {
  it('reports a place inside coverage', async () => {
    vi.mocked(geocoding.reverseGeocode).mockResolvedValue(ecija)
    const state = await createPickResolver().resolve(ecija.coordinates)
    expect(state).toEqual({ status: 'found', result: ecija, inCoverage: true })
  })

  it('reports a place outside coverage without discarding it', async () => {
    vi.mocked(geocoding.reverseGeocode).mockResolvedValue(madrid)
    const state = await createPickResolver().resolve(madrid.coordinates)
    expect(state).toMatchObject({ status: 'found', inCoverage: false })
  })

  it('reports an empty pick where no address resolves', async () => {
    vi.mocked(geocoding.reverseGeocode).mockResolvedValue(null)
    const state = await createPickResolver().resolve({ lat: 36, lng: -2 })
    expect(state).toEqual({ status: 'empty' })
  })

  it('reports an empty pick when the geocoder throws', async () => {
    vi.mocked(geocoding.reverseGeocode).mockRejectedValue(new Error('offline'))
    const state = await createPickResolver().resolve({ lat: 36, lng: -2 })
    expect(state).toEqual({ status: 'empty' })
  })

  // A slow first response must not overwrite the popup a later click opened.
  it('discards a response superseded by a newer pick', async () => {
    const resolver = createPickResolver()
    let releaseFirst: (v: typeof madrid) => void = () => {}
    vi.mocked(geocoding.reverseGeocode)
      .mockImplementationOnce(() => new Promise(res => { releaseFirst = res }))
      .mockResolvedValueOnce(ecija)

    const first = resolver.resolve(madrid.coordinates)
    const second = await resolver.resolve(ecija.coordinates)
    releaseFirst(madrid)

    expect(await first).toBeNull()
    expect(second).toMatchObject({ status: 'found', result: ecija })
  })
})
