import type { Coordinates, CoastalFloodResult } from '../types'

const COASTAL_DPH_WMS = 'https://wms.mapama.gob.es/sig/Costas/ServDPHC/wms.aspx'

// NOTE (verified 2026-07): This WMS gateway currently returns a server-side
// ASP.NET NullReferenceException for GetCapabilities AND GetFeatureInfo on
// every request — confirmed against this endpoint AND the already-live
// SNCZI flood endpoint (floodZone.ts), which shows the identical failure
// right now. This is a live outage on MITERD's whole wms.aspx gateway, not
// a wrong URL/params. Layer names below are the best candidates from public
// MITERD/datos.gob.es metadata and could not be confirmed against a live
// GetCapabilities response — re-verify once the gateway responds normally.
export const COASTAL_LAYERS = {
  servidumbre: 'DPMT_Servidumbre',
  policia: 'DPMT_ZonaPolicia',
}

const COASTAL_PROVINCES = [
  'huelva', 'cádiz', 'cadiz', 'málaga', 'malaga', 'granada', 'almería', 'almeria',
  'murcia', 'alicante', 'valencia', 'castellón', 'castellon', 'tarragona',
  'barcelona', 'girona', 'gerona', 'baleares', 'illes balears', 'las palmas',
  'santa cruz de tenerife', 'asturias', 'cantabria', 'vizcaya', 'bizkaia',
  'guipúzcoa', 'guipuzcoa', 'gipuzkoa', 'lugo', 'a coruña', 'a coruna',
  'pontevedra', 'ceuta', 'melilla',
]

// Full list of Spanish provinces with coastline — used to decide whether to
// fire the coastal query at all and whether to render the card. Inland
// provinces (Córdoba, Jaén, Ciudad Real, etc.) never see this card.
//
// Nominatim's address.county is unreliable for this check: it sometimes
// returns a comarca/tourism-region name (e.g. "Costa del Sol Occidental"
// for Marbella) instead of the actual province, and sometimes omits county
// entirely so geocoding.ts falls back to address.state (the autonomous
// community, e.g. "Andalucía" — which matches no province name). The full
// displayName reliably includes the real province name deeper in the
// comma-separated address hierarchy, so it's checked as a second signal.
export function isCoastalProvincia(provincia?: string, displayName?: string): boolean {
  const haystacks = [provincia, displayName].filter((s): s is string => !!s).map(s => s.toLowerCase())
  if (haystacks.length === 0) return false
  return COASTAL_PROVINCES.some(c => haystacks.some(h => h.includes(c)))
}

async function queryLayer(coords: Coordinates, layer: string): Promise<boolean> {
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
    if (!res.ok) return false
    const text = await res.text()
    return (
      (text.includes('"features"') && !text.includes('"features":[]')) ||
      text.includes('<gml:featureMember>') ||
      (text.includes('NumberOfFeaturesMatched') && !text.includes('NumberOfFeaturesMatched="0"'))
    )
  } catch {
    return false
  }
}

export async function getCoastalFloodStatus(coords: Coordinates): Promise<CoastalFloodResult> {
  const [inServidumbre, inPolicia] = await Promise.all([
    queryLayer(coords, COASTAL_LAYERS.servidumbre),
    queryLayer(coords, COASTAL_LAYERS.policia),
  ])
  return { inServidumbre, inPolicia, source: 'MITERD DPH' }
}

export function getCoastalWmsUrl(layer: string): string {
  return (
    `${COASTAL_DPH_WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
    `&LAYERS=${layer}&STYLES=&FORMAT=image/png&TRANSPARENT=true` +
    `&SRS=EPSG:3857&WIDTH=256&HEIGHT=256` +
    `&BBOX={bbox-epsg-3857}`
  )
}
