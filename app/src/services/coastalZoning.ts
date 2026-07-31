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
// always misses. MapServer scales its search tolerance with the query box, so
// widening the box widens the reach. The tolerance is a server-side constant we
// cannot read, so this value is tuned empirically against real answers rather
// than derived from a distance: what follows is what the live service returned,
// not a radius we measured.
//
// NOTE (verified 2026-07-30/31 against the live REDIAM service): at 0.003 every
// coastal town probed missed on both layers — Tarifa, Marbella, Lepe, Nerja,
// Roquetas all got "Search returned no results" from a healthy service, so the
// card reported no coastal zoning at unambiguously coastal addresses. Widening
// recovers them one at a time: 0.03 reaches Tarifa (ZSP Tarifa_10, "Tarifa
// Urbano") and Nerja; 0.05 adds Marbella (Marbella_14) and Roquetas de Mar;
// 0.1 adds Lepe.
//
// Attribution was checked, not just hit/miss — this matters because
// `parseFeatureInfo` takes the first feature and the service does not order by
// distance, so a box that is too wide returns a neighbour's transect and looks
// authoritative. At 0.1 every feature returned still carries the MUNICIPIO of
// the town queried (LEPE, MARBELLA, ROQUETAS DE MAR).
//
// The guard against a false positive is inland towns in coastal provinces:
// Aracena, Guadix, Órgiva, Ronda, Jerez and Córdoba all return nothing at 0.1.
// Jerez first returns a feature at 0.2, which is where this stops being safe —
// so 0.1 is the last width proven clean, not merely a width that happened to
// work. `coastalZoning.test.ts` pins the box width at both ends.
//
// Widening further would not help anyway: the server's tolerance grows much
// more slowly than the box, so reach is roughly a few pixels either way.
// Níjar still misses at 0.3 even though ZSP publishes profiles along its own
// coast (San José, Las Negras, Agua Amarga all return MUNICIPIO = NIJAR when
// queried directly). Its centroid is ~25 km from that coastline. Fixing that
// case needs the query moved to the nearest coastline point, not a bigger box.
const QUERY_DELTA = 0.1
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
