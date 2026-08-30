import { describe, it, expect, vi, afterEach } from 'vitest'
import { geocodeAddress, reverseGeocode } from './geocoding'

afterEach(() => vi.unstubAllGlobals())

const respond = (body: unknown, ok = true) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => body })))

describe('reverseGeocode', () => {
  it('maps an address to a PlaceContext', async () => {
    respond({
      display_name: 'Écija, Sevilla, Andalucía, España',
      osm_type: 'relation',
      osm_id: 340442,
      lat: '37.54',
      lon: '-5.08',
      address: {
        town: 'Écija',
        province: 'Sevilla',
        state: 'Andalucía',
        country_code: 'es',
        'ISO3166-2-lvl4': 'ES-AN',
        'ISO3166-2-lvl6': 'ES-SE',
      },
    })
    const result = await reverseGeocode({ lat: 37.54, lng: -5.08 })
    expect(result?.municipality).toBe('Écija')
    expect(result?.countryCode).toBe('es')
    expect(result?.region).toBe('ES-AN')
    expect(result?.province).toBe('ES-SE')
    expect(result?.osmId).toBe('relation/340442')
  })

  // Regression: Nominatim returns `province` and no `county` for Andalusian
  // cities. Reading `county ?? state` made the province "Andalucía", which
  // failed every province-level check downstream — coastal and bathing-water
  // datasets never appeared for Seville.
  it('prefers province over state when Nominatim omits county', async () => {
    respond({
      display_name: 'Sevilla, Andalucía, España',
      lat: '37.38',
      lon: '-5.99',
      address: { city: 'Sevilla', province: 'Sevilla', state: 'Andalucía', country_code: 'es' },
    })
    const result = await reverseGeocode({ lat: 37.38, lng: -5.99 })
    expect(result?.provinceName).toBe('Sevilla')
  })

  it('maps a French address', async () => {
    respond({
      display_name: 'Marseille, Bouches-du-Rhône, France',
      lat: '43.29',
      lon: '5.37',
      address: {
        city: 'Marseille',
        county: 'Bouches-du-Rhône',
        state: "Provence-Alpes-Côte d'Azur",
        country_code: 'fr',
        'ISO3166-2-lvl4': 'FR-PAC',
        'ISO3166-2-lvl6': 'FR-13',
      },
    })
    const result = await reverseGeocode({ lat: 43.29, lng: 5.37 })
    expect(result?.countryCode).toBe('fr')
    expect(result?.provinceName).toBe('Bouches-du-Rhône')
    expect(result?.province).toBe('FR-13')
  })

  it('maps an Italian address', async () => {
    respond({
      display_name: 'Palermo, Sicilia, Italia',
      lat: '38.11',
      lon: '13.36',
      address: {
        city: 'Palermo',
        county: 'Palermo',
        state: 'Sicilia',
        country_code: 'it',
        'ISO3166-2-lvl4': 'IT-82',
        'ISO3166-2-lvl6': 'IT-PA',
      },
    })
    const result = await reverseGeocode({ lat: 38.11, lng: 13.36 })
    expect(result?.countryCode).toBe('it')
    expect(result?.province).toBe('IT-PA')
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

describe('geocodeAddress', () => {
  // The country list biases ranking so "Córdoba, Spain" beats "Córdoba,
  // Argentina". It must never become a filter — coverage is a descriptor now,
  // and a place outside the list would otherwise be unreachable.
  it('biases towards Mediterranean countries', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => [],
    }))
    vi.stubGlobal('fetch', fetchMock)

    await geocodeAddress('Córdoba')

    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('countrycodes=es%2Cpt%2Cfr%2Cit%2Cgr%2Chr%2Csi%2Cmt%2Ccy')
  })

  it('maps every suggestion', async () => {
    respond([
      {
        display_name: 'Ronda, Málaga, Andalucía, España',
        lat: '36.74',
        lon: '-5.16',
        address: { town: 'Ronda', province: 'Málaga', country_code: 'es' },
      },
    ])
    const results = await geocodeAddress('Ronda')
    expect(results).toHaveLength(1)
    expect(results[0].municipality).toBe('Ronda')
    expect(results[0].coordinates).toEqual({ lat: 36.74, lng: -5.16 })
  })
})
