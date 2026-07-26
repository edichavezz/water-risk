import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPickResolver, hitsInteractiveLayer } from './pickLocation'
import * as geocoding from '../services/geocoding'

vi.mock('../services/geocoding')

const ecija = {
  displayName: 'Écija, Sevilla', coordinates: { lat: 37.54, lng: -5.08 },
  municipio: 'Écija', provincia: 'Sevilla', basin: 'guadalquivir' as const,
}
const madrid = {
  displayName: 'Madrid', coordinates: { lat: 40.42, lng: -3.7 },
  municipio: 'Madrid', provincia: 'Madrid',
}

beforeEach(() => vi.resetAllMocks())

describe('hitsInteractiveLayer', () => {
  const fakeMap = (features: unknown[]) =>
    ({ queryRenderedFeatures: () => features }) as never

  // Without this guard a click on a reservoir circle would fire both the
  // reservoir handler and the picker — MapLibre suppresses neither.
  it('is true when a clickable data feature is under the pointer', () => {
    expect(hitsInteractiveLayer(fakeMap([{ id: 1 }]), { x: 10, y: 10 })).toBe(true)
  })

  it('is false over bare basemap', () => {
    expect(hitsInteractiveLayer(fakeMap([]), { x: 10, y: 10 })).toBe(false)
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
