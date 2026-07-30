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
 * passing a URL, every layer named must be one this app actually draws, and the
 * request type must be one of GetMap, GetFeatureInfo or GetCapabilities — the
 * latter two only for upstreams that opt in. Response types are checked too, so
 * a WMS fault (served with a 200) is never passed off as a tile or as data.
 */

interface Upstream {
  url: string
  layers: string[]
  /** Browser cache lifetime for relayed tiles, in seconds. */
  maxAge: number
  /**
   * Whether GetFeatureInfo may be relayed as well as GetMap. Opt-in per
   * upstream: a feature query returns attribute text rather than an image, so
   * it is a wider surface than a tile relay and is only opened where the app
   * actually reads attributes.
   */
  allowFeatureInfo?: boolean
  /**
   * Whether GetCapabilities may be relayed. Opt-in for the same reason: it is
   * how the app learns which time slice a temporal layer is actually serving,
   * and it returns XML rather than an image.
   */
  allowCapabilities?: boolean
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
    // The panel reads the zoning classification and profile attributes off
    // these layers, since the national deslinde service that would answer the
    // in-servitude question is down.
    allowFeatureInfo: true,
  },

  // Copernicus sends `Access-Control-Allow-Origin: *` twice on every response.
  // Chrome rejects duplicate ACAO values per the Fetch spec ("contains
  // multiple values '*, *', but only one is allowed"), so a CORS-mode fetch
  // fails even though the service is healthy and a plain <img> loads fine.
  // That breaks both the raster tiles and the pixel sampling the panel needs,
  // so this one is relayed purely to get a single well-formed CORS header.
  'copernicus-drought': {
    url: 'https://drought.emergency.copernicus.eu/api/wms',
    // cdinx is the abandoned variant of the same product: its time dimension
    // stops at 2024-01-01 while cdiad — identical indicator, identical version,
    // byte-identical legend palette — is still published. Both are listed so a
    // cached client asking for the old one still gets a tile.
    layers: ['cdiad', 'cdinx'],
    // The CDI is published on a 10-day cycle; refresh daily so a new slice is
    // picked up promptly without re-fetching on every pan.
    maxAge: DAY,
    // The panel dates the reading from the layer's own TIME dimension rather
    // than stamping "today" on whatever slice the service happens to serve.
    allowCapabilities: true,
  },
}

// Everything a GetMap needs and nothing that could redirect the request
// elsewhere. Compared case-insensitively; WMS param names are not case-fixed.
const ALLOWED_PARAMS = new Set([
  'service', 'version', 'request', 'layers', 'styles', 'format',
  'transparent', 'srs', 'crs', 'width', 'height', 'bbox', 'bgcolor',
  // GetFeatureInfo only. `info_format` is accepted but always overwritten
  // below; it is listed so a caller-supplied value is not simply appended.
  'query_layers', 'x', 'y', 'i', 'j', 'info_format', 'feature_count',
  // Temporal layers: the app pins the slice it dates the reading from.
  'time',
])

const MAX_DIMENSION = 2048
const MAX_FEATURE_COUNT = 50

// Pinned rather than passed through: text/plain is the only shape the parser
// expects, and it keeps HTML out of a response the panel renders.
const INFO_FORMAT = 'text/plain'

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

  const request = (params.get('REQUEST') ?? params.get('request') ?? '').toLowerCase()
  const isFeatureInfo = request === 'getfeatureinfo'
  const isCapabilities = request === 'getcapabilities'
  if (request !== 'getmap' && !isFeatureInfo && !isCapabilities) {
    return fail(400, 'Only GetMap, GetFeatureInfo and GetCapabilities are proxied')
  }
  if (isFeatureInfo && !upstream.allowFeatureInfo) {
    return fail(400, 'Feature queries are not proxied for this upstream')
  }
  if (isCapabilities && !upstream.allowCapabilities) {
    return fail(400, 'Capabilities are not proxied for this upstream')
  }

  // A capabilities document names no layer and has no raster, so the layer and
  // dimension checks below do not apply to it.
  if (isCapabilities) {
    let capRes: Response
    try {
      capRes = await fetchImpl(`${upstream.url}?${params}`)
    } catch {
      return fail(502, 'Upstream unreachable')
    }
    if (!capRes.ok) return fail(502, `Upstream returned ${capRes.status}`)
    const capType = capRes.headers.get('content-type') ?? ''
    if (!/xml/i.test(capType)) return fail(502, 'Upstream returned a non-XML capabilities document')
    return {
      status: 200,
      contentType: capType,
      body: await capRes.text(),
      cacheControl: `public, max-age=${upstream.maxAge}, s-maxage=${upstream.maxAge * 7}`,
    }
  }

  // Both layer lists are validated. LAYERS alone would not be enough: on a
  // GetFeatureInfo it is QUERY_LAYERS that selects what gets read.
  const layerLists = [params.get('LAYERS') ?? params.get('layers') ?? '']
  if (isFeatureInfo) {
    layerLists.push(params.get('QUERY_LAYERS') ?? params.get('query_layers') ?? '')
  }
  for (const list of layerLists) {
    const requested = list.split(',').filter(Boolean)
    if (requested.length === 0 || !requested.every(l => upstream.layers.includes(l))) {
      return fail(400, 'Unknown layer')
    }
  }

  const dims: Record<string, number> = {}
  for (const dim of ['WIDTH', 'HEIGHT']) {
    const n = Number(params.get(dim) ?? params.get(dim.toLowerCase()))
    if (!Number.isFinite(n) || n <= 0 || n > MAX_DIMENSION) {
      return fail(400, `Invalid ${dim}`)
    }
    dims[dim] = n
  }

  if (isFeatureInfo) {
    // The pixel being asked about has to lie inside the raster just described,
    // or the query is malformed however the upstream chooses to treat it.
    for (const [axis, limit] of [['X', dims.WIDTH], ['Y', dims.HEIGHT], ['I', dims.WIDTH], ['J', dims.HEIGHT]] as const) {
      const raw = params.get(axis) ?? params.get(axis.toLowerCase())
      if (raw === null || raw === undefined) continue
      const n = Number(raw)
      if (!Number.isInteger(n) || n < 0 || n >= limit) return fail(400, `Invalid ${axis}`)
    }

    const rawCount = params.get('FEATURE_COUNT') ?? params.get('feature_count')
    if (rawCount !== null && rawCount !== undefined) {
      const n = Number(rawCount)
      if (!Number.isInteger(n) || n <= 0 || n > MAX_FEATURE_COUNT) {
        return fail(400, 'Invalid FEATURE_COUNT')
      }
    }

    for (const key of ['INFO_FORMAT', 'info_format']) params.delete(key)
    params.set('INFO_FORMAT', INFO_FORMAT)
  }

  let res: Response
  try {
    res = await fetchImpl(`${upstream.url}?${params}`)
  } catch {
    return fail(502, 'Upstream unreachable')
  }
  if (!res.ok) return fail(502, `Upstream returned ${res.status}`)

  const contentType = res.headers.get('content-type') ?? ''
  const cacheControl = `public, max-age=${upstream.maxAge}, s-maxage=${upstream.maxAge * 7}`

  if (isFeatureInfo) {
    // A WMS reports failure as an XML ServiceExceptionReport with a 200. For a
    // feature query that arrives as text/xml rather than the text/plain asked
    // for, so the content type is the tell — and an XML body must never be
    // handed to the parser as though it were an answer.
    const body = await res.text()
    if (!contentType.startsWith('text/plain') || body.includes('ServiceException')) {
      return fail(502, 'Upstream returned a fault instead of feature text')
    }
    return { status: 200, contentType, body, cacheControl }
  }

  // A tile response must actually be an image, for the same reason.
  if (!contentType.startsWith('image/')) return fail(502, 'Upstream returned a non-image')

  return {
    status: 200,
    contentType,
    body: await res.arrayBuffer(),
    cacheControl,
  }
}
