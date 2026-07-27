/**
 * Relays tiles from WMS services the browser cannot load directly — either
 * because they send no CORS headers at all, or because the headers they do
 * send are malformed.
 *
 * Only used where there is no working direct route. The flood service (IDEE)
 * sends a single well-formed `Access-Control-Allow-Origin: *` and is fetched
 * directly; it must not be routed through here.
 *
 * This is a proxy, so it is an SSRF risk if it forwards whatever it is given.
 * It does not: the caller names an upstream from a fixed table rather than
 * passing a URL, the layer must be one this app actually draws, and only
 * GetMap is relayed.
 */

interface Upstream {
  url: string
  layers: string[]
  /** Browser cache lifetime for relayed tiles, in seconds. */
  maxAge: number
}

const DAY = 86400

export const UPSTREAMS: Record<string, Upstream> = {
  // MITECO's national DPMT gateway (wms.mapama.gob.es) has been returning a
  // server-side NullReferenceException for every request. REDIAM publishes the
  // Andalucía zoning of the same protection zone, and is already this app's
  // source for reservoirs — but it sends no CORS headers.
  'rediam-coastal': {
    url: 'https://www.juntadeandalucia.es/medioambiente/mapwms/REDIAM_perfiles_zonas_servidumbre_proteccion',
    layers: ['ZSP', 'Tramos_homogeneos'],
    // Coastal zoning changes on the order of years.
    maxAge: DAY,
  },

  // Copernicus sends `Access-Control-Allow-Origin: *` twice on every response.
  // Chrome rejects duplicate ACAO values per the Fetch spec ("contains
  // multiple values '*, *', but only one is allowed"), so a CORS-mode fetch
  // fails even though the service is healthy and a plain <img> loads fine.
  // That breaks both the raster tiles and the pixel sampling the panel needs,
  // so this one is relayed purely to get a single well-formed CORS header.
  'copernicus-drought': {
    url: 'https://drought.emergency.copernicus.eu/api/wms',
    layers: ['cdinx'],
    // The CDI is published on a 10-day cycle; refresh daily so a new slice is
    // picked up promptly without re-fetching on every pan.
    maxAge: DAY,
  },
}

// Everything a GetMap needs and nothing that could redirect the request
// elsewhere. Compared case-insensitively; WMS param names are not case-fixed.
const ALLOWED_PARAMS = new Set([
  'service', 'version', 'request', 'layers', 'styles', 'format',
  'transparent', 'srs', 'crs', 'width', 'height', 'bbox', 'bgcolor',
])

const MAX_DIMENSION = 2048

export interface ProxyResult {
  status: number
  contentType: string
  body: ArrayBuffer | string
  /** Cache-Control for a successful relay; absent on errors. */
  cacheControl?: string
}

function fail(status: number, message: string): ProxyResult {
  return { status, contentType: 'application/json', body: JSON.stringify({ error: message }) }
}

/**
 * Validates `query` and, if it passes, fetches the tile from the named
 * upstream. `fetchImpl` is injectable so the validation can be tested without
 * touching the network.
 */
export async function proxyWms(
  query: Record<string, string | string[] | undefined>,
  fetchImpl: typeof fetch = fetch,
): Promise<ProxyResult> {
  const single = (k: string): string | undefined => {
    const v = query[k]
    return Array.isArray(v) ? v[0] : v
  }

  const upstream = UPSTREAMS[single('upstream') ?? '']
  if (!upstream) return fail(400, 'Unknown upstream')

  const params = new URLSearchParams()
  for (const [key, raw] of Object.entries(query)) {
    if (key === 'upstream') continue
    const lower = key.toLowerCase()
    if (!ALLOWED_PARAMS.has(lower)) continue
    const value = Array.isArray(raw) ? raw[0] : raw
    if (value !== undefined) params.set(key, value)
  }

  // Only GetMap. GetFeatureInfo would widen this into a general query relay,
  // and nothing in the app needs it here.
  if ((params.get('REQUEST') ?? params.get('request') ?? '').toLowerCase() !== 'getmap') {
    return fail(400, 'Only GetMap is proxied')
  }

  const layers = params.get('LAYERS') ?? params.get('layers') ?? ''
  const requested = layers.split(',').filter(Boolean)
  if (requested.length === 0 || !requested.every(l => upstream.layers.includes(l))) {
    return fail(400, 'Unknown layer')
  }

  for (const dim of ['WIDTH', 'HEIGHT']) {
    const n = Number(params.get(dim) ?? params.get(dim.toLowerCase()))
    if (!Number.isFinite(n) || n <= 0 || n > MAX_DIMENSION) {
      return fail(400, `Invalid ${dim}`)
    }
  }

  let res: Response
  try {
    res = await fetchImpl(`${upstream.url}?${params}`)
  } catch {
    return fail(502, 'Upstream unreachable')
  }
  if (!res.ok) return fail(502, `Upstream returned ${res.status}`)

  const contentType = res.headers.get('content-type') ?? ''
  // A WMS reports failure as an XML ServiceExceptionReport with a 200, which
  // must not be passed off to the map as if it were a tile.
  if (!contentType.startsWith('image/')) return fail(502, 'Upstream returned a non-image')

  return {
    status: 200,
    contentType,
    body: await res.arrayBuffer(),
    cacheControl: `public, max-age=${upstream.maxAge}, s-maxage=${upstream.maxAge * 7}`,
  }
}
