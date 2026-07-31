import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseFeatureInfo, getCoastalZoning } from './coastalZoning'

// Verbatim shapes captured from REDIAM on 2026-07-29 (Cádiz, Barriada de La Paz).
const TRAMO_BODY = `GetFeatureInfo results:

Layer 'Tramos_homogeneos'
  Feature 522:
    Escenario = '14'
    Provincia = 'Cádiz'
    ZSP = 'Áreas Urbanas e Industriales Consolidadas'
    DPMT = 'Sensible'
    id = '327'
    Ubicacion = 'Núcleo urbano de Cádiz'
    has = '24.893'
`

const PROFILE_BODY = `GetFeatureInfo results:

Layer 'ZSP'
  Feature 224:
    IDPERFIL = '1134'
    PERFIL = 'Cadiz_02'
    PROVINCIA = 'Cadiz'
    MUNICIPIO = 'CADIZ'
    UBICACION = 'Barriada de La Paz'
    HITO = 'M-5'
    PUBLICPDF = 'https://portalrediam.cica.es/repositorio/x/Cadiz_02.pdf'
`

const EMPTY = `GetFeatureInfo results:

  Search returned no results.
`

describe('parseFeatureInfo', () => {
  it('reads the attributes of the first feature', () => {
    const f = parseFeatureInfo(TRAMO_BODY)
    expect(f).toMatchObject({
      ZSP: 'Áreas Urbanas e Industriales Consolidadas',
      DPMT: 'Sensible',
      Ubicacion: 'Núcleo urbano de Cádiz',
    })
  })

  it('returns null when the service found nothing', () => {
    expect(parseFeatureInfo(EMPTY)).toBeNull()
  })

  it('returns null for a fault body rather than inventing attributes', () => {
    expect(parseFeatureInfo('<ServiceExceptionReport/>')).toBeNull()
  })

  it('returns null for an empty response', () => {
    expect(parseFeatureInfo('')).toBeNull()
  })
})

describe('getCoastalZoning', () => {
  const coords = { lat: 36.51659, lng: -6.27214 }

  function respondWith(map: Record<string, string>) {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const layer = /QUERY_LAYERS=([^&]+)/.exec(url)?.[1] ?? ''
      const body = map[decodeURIComponent(layer)]
      if (body === undefined) return new Response('', { status: 502 })
      return new Response(body, { status: 200, headers: { 'content-type': 'text/plain' } })
    }))
  }

  afterEach(() => vi.unstubAllGlobals())

  it('combines the stretch classification and the nearest profile', async () => {
    respondWith({ Tramos_homogeneos: TRAMO_BODY, ZSP: PROFILE_BODY })
    const z = await getCoastalZoning(coords)
    expect(z).toMatchObject({
      zoning: 'Áreas Urbanas e Industriales Consolidadas',
      sensitivity: 'Sensible',
      location: 'Núcleo urbano de Cádiz',
      profile: 'Cadiz_02',
      marker: 'M-5',
      profileUrl: 'https://portalrediam.cica.es/repositorio/x/Cadiz_02.pdf',
    })
  })

  it('returns null when neither layer has anything here', async () => {
    // An inland point: no zoning applies, which is a real answer, not an error.
    respondWith({ Tramos_homogeneos: EMPTY, ZSP: EMPTY })
    expect(await getCoastalZoning(coords)).toBeNull()
  })

  it('still reports the stretch when the profile layer misses', async () => {
    // The two geometries do not coincide, so one can hit without the other.
    respondWith({ Tramos_homogeneos: TRAMO_BODY, ZSP: EMPTY })
    const z = await getCoastalZoning(coords)
    expect(z?.zoning).toBe('Áreas Urbanas e Industriales Consolidadas')
    expect(z?.profile).toBeUndefined()
  })

  it('throws when the service itself fails, so the card shows an error', async () => {
    // Distinguished from "nothing here": an outage must not read as "no zoning".
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502 })))
    await expect(getCoastalZoning(coords)).rejects.toThrow()
  })

  it('queries a box wide enough to reach the zoning geometry', async () => {
    // The stretches and transects are lines, so the query box width drives how
    // far MapServer's search tolerance reaches. At the original 0.003 every
    // coastal town probed — Tarifa, Marbella, Nerja, Roquetas — returned
    // "Search returned no results" from a healthy service, and the card
    // reported no coastal zoning at plainly coastal addresses. The lower bound
    // pins the fix; the upper bound keeps the box from growing until it starts
    // returning a neighbouring municipality's transect, since the parser takes
    // the first feature and the service does not order by distance. See the
    // NOTE on QUERY_DELTA for the probe this encodes.
    const seen: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      seen.push(url)
      return new Response(EMPTY, { status: 200, headers: { 'content-type': 'text/plain' } })
    }))
    await getCoastalZoning(coords)

    const bbox = /BBOX=([^&]+)/.exec(seen[0])?.[1] ?? ''
    const [minLng, , maxLng] = decodeURIComponent(bbox).split(',').map(Number)
    const widthKm = (maxLng - minLng) * 111 * Math.cos((coords.lat * Math.PI) / 180)
    expect(widthKm).toBeGreaterThan(8)
    expect(widthKm).toBeLessThan(12)
  })

  it('rejects a profileUrl that is not a REDIAM https link', async () => {
    const evil = PROFILE_BODY.replace(
      'https://portalrediam.cica.es/repositorio/x/Cadiz_02.pdf',
      'javascript:alert(1)',
    )
    respondWith({ Tramos_homogeneos: TRAMO_BODY, ZSP: evil })
    expect((await getCoastalZoning(coords))?.profileUrl).toBeUndefined()
  })
})
