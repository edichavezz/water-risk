import type { Coordinates, CoastalZoning } from '../types'

const COASTAL_PROXY = '/api/wms-proxy?upstream=rediam-coastal'

/**
 * REDIAM's coastal zoning, read as attributes rather than drawn as tiles.
 *
 * This is deliberately *not* the in-servitude verdict. MITECO's national
 * deslinde service — the only source that can say whether a given property lies
 * inside the 20 m servidumbre or the 100 m policía strip — has been returning a
 * server-side fault for every request. What REDIAM publishes instead is the
 * Andalucía management zoning of the same protection zone: homogeneous stretches
 * with a classification, plus surveyed profiles along the coast.
 *
 * The geometries are stretches and transects, not filled polygons, so a hit
 * means "this is the zoning in force around this point", never "your plot is
 * inside the strip". The panel copy has to say so.
 */

// The zoning geometries are lines and transects, so a pixel-exact query almost
// always misses. This box is about 300 m across — wide enough to catch the
// stretch a point sits on, narrow enough that an inland point finds nothing
// (verified against Córdoba, 200 km inland, which returns no features).
const QUERY_DELTA = 0.003
const GRID = 101

function featureInfoUrl(coords: Coordinates, layer: string): string {
  const { lat, lng } = coords
  const bbox = [
    lng - QUERY_DELTA, lat - QUERY_DELTA,
    lng + QUERY_DELTA, lat + QUERY_DELTA,
  ].join(',')

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    LAYERS: layer,
    QUERY_LAYERS: layer,
    STYLES: '',
    BBOX: bbox,
    WIDTH: String(GRID),
    HEIGHT: String(GRID),
    SRS: 'EPSG:4326',
    X: String((GRID - 1) / 2),
    Y: String((GRID - 1) / 2),
    FEATURE_COUNT: '5',
  })
  return `${COASTAL_PROXY}&${params}`
}

/**
 * Pulls the first feature's attributes out of a MapServer text/plain response.
 * Returns null for "no results", a fault, or anything it cannot read — the
 * caller must not be able to mistake an unparseable body for an empty area.
 */
export function parseFeatureInfo(body: string): Record<string, string> | null {
  if (!body || body.includes('ServiceException')) return null
  if (!/Feature\s+\d+\s*:/.test(body)) return null

  const attrs: Record<string, string> = {}
  // Attribute lines look like:  KEY = 'value'
  for (const line of body.split('\n')) {
    const m = /^\s*([A-Za-zÀ-ÿ_][\w À-ÿ]*?)\s*=\s*'(.*)'\s*$/.exec(line)
    if (m) {
      const [, key, value] = m
      // Only the first feature: a repeated key means the next one has started.
      if (key in attrs) break
      attrs[key] = value.trim()
    }
  }
  return Object.keys(attrs).length > 0 ? attrs : null
}

// Upstream supplies this URL, so it is treated as untrusted input: only an
// https link to REDIAM's own repository is passed through to an anchor.
function safeProfileUrl(raw?: string): string | undefined {
  if (!raw) return undefined
  try {
    const u = new URL(raw)
    const ok = u.protocol === 'https:' && u.hostname.endsWith('.cica.es')
    return ok ? u.toString() : undefined
  } catch {
    return undefined
  }
}

async function queryLayer(
  coords: Coordinates,
  layer: string,
): Promise<Record<string, string> | null> {
  const res = await fetch(featureInfoUrl(coords, layer))
  if (!res.ok) throw new Error(`Coastal zoning query failed (${res.status})`)
  return parseFeatureInfo(await res.text())
}

/**
 * The zoning in force around a point, or null where none applies.
 *
 * Throws when the service cannot be reached, so an outage surfaces as an error
 * rather than as "no coastal zoning here" — the same distinction the reservoir
 * and flood cards already make.
 */
export async function getCoastalZoning(coords: Coordinates): Promise<CoastalZoning | null> {
  const [tramo, profile] = await Promise.all([
    queryLayer(coords, 'Tramos_homogeneos'),
    // A profile miss is not a failure: the two geometries do not coincide, so
    // the stretch alone is still a usable answer.
    queryLayer(coords, 'ZSP').catch(() => null),
  ])

  if (!tramo && !profile) return null

  return {
    zoning: tramo?.ZSP,
    sensitivity: tramo?.DPMT,
    location: tramo?.Ubicacion ?? profile?.UBICACION,
    provincia: tramo?.Provincia ?? profile?.PROVINCIA,
    profile: profile?.PERFIL,
    marker: profile?.HITO,
    profileUrl: safeProfileUrl(profile?.PUBLICPDF),
    source: 'REDIAM',
  }
}
