import type { Coordinates, CoastalFloodResult } from '../types'

const COASTAL_DPH_WMS = 'https://wms.mapama.gob.es/sig/Costas/ServDPHC/wms.aspx'

// NOTE (re-verified 2026-07): MITECO's whole wms.aspx gateway is still down —
// every path returns a server-side NullReferenceException naming
// ConstruirServiceArcGISBaseUrl, i.e. the ASP.NET proxy cannot reach its own
// ArcGIS backend. That includes the endpoint datos.gob.es still publishes as
// the official DPMT service, and the KMZ fallback it lists now redirects to an
// HTML page. Nothing on our side can fix this; the national deslinde is simply
// unavailable, so the panel's in-servitude verdict stays unanswerable.
//
// The map layer, however, has a live stand-in: REDIAM publishes the Andalucía
// zoning of the same protection zone (see COASTAL_MAP below).
export const COASTAL_LAYERS = {
  servidumbre: 'DPMT_Servidumbre',
  policia: 'DPMT_ZonaPolicia',
}

// REDIAM's coastal zoning, relayed through /api/wms-proxy because the service
// sends no CORS headers. Andalucía only, which matches this app's
// detailed-coverage area.
//
// This is the *management zoning* of the protection zone — `ZSP` holds the
// profile transects and `Tramos_homogeneos` the homogeneous stretches — not
// the DPMT deslinde boundary itself. It is honest as a map overlay showing
// where coastal protection applies, and deliberately not used to answer
// whether a given address falls inside the servitude: profiles cannot support
// a point-in-polygon verdict, and claiming otherwise would be the same kind of
// confident-but-wrong answer the dead flood endpoint was producing.
export const COASTAL_MAP_LAYERS = {
  zsp: 'ZSP',
  tramos: 'Tramos_homogeneos',
}

// Returns null — rather than false — when the service could not be reached,
// so a dead upstream is distinguishable from a genuine "not in this zone".
async function queryLayer(coords: Coordinates, layer: string): Promise<boolean | null> {
  const delta = 0.001
  const bbox = `${coords.lng - delta},${coords.lat - delta},${coords.lng + delta},${coords.lat + delta}`

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    LAYERS: layer,
    QUERY_LAYERS: layer,
    STYLES: '',
    BBOX: bbox,
    WIDTH: '10',
    HEIGHT: '10',
    SRS: 'EPSG:4326',
    X: '5',
    Y: '5',
    INFO_FORMAT: 'application/json',
    FEATURE_COUNT: '1',
  })

  try {
    const res = await fetch(`${COASTAL_DPH_WMS}?${params}`)
    if (!res.ok) return null
    const text = await res.text()
    // The gateway answers with a ServiceExceptionReport and a 200 while it is
    // broken, which is an outage, not an absence of features.
    if (text.includes('ServiceExceptionReport')) return null
    return (
      (text.includes('"features"') && !text.includes('"features":[]')) ||
      text.includes('<gml:featureMember>') ||
      (text.includes('NumberOfFeaturesMatched') && !text.includes('NumberOfFeaturesMatched="0"'))
    )
  } catch {
    return null
  }
}

export async function getCoastalFloodStatus(coords: Coordinates): Promise<CoastalFloodResult> {
  const [servidumbre, policia] = await Promise.all([
    queryLayer(coords, COASTAL_LAYERS.servidumbre),
    queryLayer(coords, COASTAL_LAYERS.policia),
  ])

  // While the gateway is down every query fails, and reporting that as
  // "outside the mapped coastal zones" would be a confident wrong answer about
  // whether a property sits in the protection zone — the same false negative
  // the dead flood endpoint was producing. Surface it as an error instead.
  if (servidumbre === null && policia === null) {
    throw new Error('MITERD coastal DPH service unavailable')
  }

  return {
    inServidumbre: servidumbre ?? false,
    inPolicia: policia ?? false,
    source: 'MITERD DPH',
  }
}

export function getCoastalWmsUrl(layer: string): string {
  return (
    `/api/wms-proxy?upstream=rediam-coastal` +
    `&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
    `&LAYERS=${encodeURIComponent(layer)}&STYLES=&FORMAT=image/png&TRANSPARENT=true` +
    `&SRS=EPSG:3857&WIDTH=256&HEIGHT=256` +
    `&BBOX={bbox-epsg-3857}`
  )
}
