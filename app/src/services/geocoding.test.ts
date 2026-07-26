import { describe, it, expect, vi, afterEach } from 'vitest'
import { reverseGeocode } from './geocoding'

afterEach(() => vi.unstubAllGlobals())

const respond = (body: unknown, ok = true) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => body })))

describe('reverseGeocode', () => {
  it('maps an address to a SearchResult', async () => {
    respond({
      display_name: 'Écija, Sevilla, España',
      lat: '37.54', lon: '-5.08',
      address: { town: 'Écija', county: 'Sevilla' },
    })
    const result = await reverseGeocode({ lat: 37.54, lng: -5.08 })
    expect(result?.municipio).toBe('Écija')
    expect(result?.basin).toBe('guadalquivir')
  })

  // Nominatim answers unresolvable coordinates — open sea, unmapped ground —
  // with HTTP 200 and an error body carrying no `address` key.
  it('returns null when the point resolves to no address', async () => {
    respond({ error: 'Unable to geocode' })
    expect(await reverseGeocode({ lat: 36.0, lng: -2.0 })).toBeNull()
  })

  it('returns null on a failed request', async () => {
    respond({}, false)
    expect(await reverseGeocode({ lat: 37.54, lng: -5.08 })).toBeNull()
  })
})
