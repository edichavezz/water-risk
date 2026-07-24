import type { Coordinates, FloodZoneResult } from '../types'

// SNCZI WMS endpoint (MITERD)
const SNCZI_WMS = 'https://wms.mapama.gob.es/sig/Agua/ZonasInundables/wms.aspx'

// Query SNCZI flood zones using WMS GetFeatureInfo for a point
export async function getFloodZoneStatus(coords: Coordinates): Promise<FloodZoneResult> {
  // WMS GetFeatureInfo: we query three return-period layers in order (worst first)
  // T10 = 10-year, T100 = 100-year, T500 = 500-year
  const layers = [
    { layer: 'Lam_Inundacion_T10', period: '10' as const },
    { layer: 'Lam_Inundacion_T100', period: '100' as const },
    { layer: 'Lam_Inundacion_T500', period: '500' as const },
  ]

  // Build a tiny bounding box around the point for GetFeatureInfo
  const delta = 0.001
  const bbox = `${coords.lng - delta},${coords.lat - delta},${coords.lng + delta},${coords.lat + delta}`

  for (const { layer, period } of layers) {
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
      const res = await fetch(`${SNCZI_WMS}?${params}`)
      if (!res.ok) continue

      const text = await res.text()

      // WMS may return GML, JSON, or text depending on server
      // If we get features, the point is in this flood zone
      const hasFeatures =
        text.includes('"features"') && !text.includes('"features":[]') ||
        text.includes('<gml:featureMember>') ||
        (text.includes('NumberOfFeaturesMatched') && !text.includes('NumberOfFeaturesMatched="0"'))

      if (hasFeatures) {
        return {
          inZone: true,
          returnPeriod: period,
          source: 'SNCZI',
        }
      }
    } catch {
      // Network error for this layer — continue
      continue
    }
  }

  return { inZone: false, source: 'SNCZI' }
}

// Returns the WMS URL for use as a MapLibre raster source
export function getSNCZIWmsUrl(layer: string): string {
  return (
    `${SNCZI_WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
    `&LAYERS=${layer}&STYLES=&FORMAT=image/png&TRANSPARENT=true` +
    `&SRS=EPSG:3857&WIDTH=256&HEIGHT=256` +
    `&BBOX={bbox-epsg-3857}`
  )
}

export const SNCZI_LAYERS = {
  T10: 'Lam_Inundacion_T10',
  T100: 'Lam_Inundacion_T100',
  T500: 'Lam_Inundacion_T500',
}
