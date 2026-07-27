import type { Coordinates, DroughtStatus } from '../types'
import { samplePixel, sampleUrl, nearestColour } from './wmsSample'

// Copernicus EDO/GDO drought products, relayed through this app's WMS proxy.
//
// The old endpoint (edo.jrc.ec.europa.eu/geoserver/edo/wms) redirects to
// drought.emergency.copernicus.eu, where every /geoserver path 404s; the
// service now lives under /api/wms.
//
// It cannot be fetched directly, though: it sends
// `Access-Control-Allow-Origin: *` *twice*, and browsers reject duplicate ACAO
// values per the Fetch spec, so every CORS-mode request fails with a bare
// "Failed to fetch" while a plain <img> of the same URL loads fine. The proxy
// exists to reissue a single well-formed header.
const EDO_WMS = '/api/wms-proxy?upstream=copernicus-drought'

// Combined Drought Indicator v4.1. Passing an explicit TIME is rejected with
// DATE_OUT_OF_RANGE around the edges of the 10-day publishing cycle, so we let
// the service pick its own latest slice.
const CDI_LAYER = 'cdinx'

/**
 * The CDI palette, read from the layer's own GetLegendGraphic. It is the
 * Okabe-Ito colourblind-safe set, so the classes are far apart in RGB and a
 * nearest-colour match is unambiguous.
 */
const CDI_PALETTE: { rgb: [number, number, number]; value: DroughtStatus['level'] }[] = [
  { rgb: [255, 255, 255], value: 'none' },              // Normal, no drought
  { rgb: [240, 228, 66], value: 'watch' },              // Watch
  { rgb: [230, 159, 0], value: 'warning' },             // Warning
  { rgb: [220, 5, 12], value: 'alert' },                // Alert
  { rgb: [0, 114, 178], value: 'recovery' },            // Full recovery
  { rgb: [204, 121, 167], value: 'partial_recovery' },  // Temporary soil moisture recovery
  { rgb: [0, 158, 115], value: 'partial_recovery' },    // Temporary fAPAR recovery
  { rgb: [200, 200, 200], value: 'unknown' },           // No data
]

export function getDroughtWmsUrl(): string {
  return (
    `${EDO_WMS}&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
    `&LAYERS=${CDI_LAYER}&STYLES=&FORMAT=image/png&TRANSPARENT=true` +
    `&SRS=EPSG:3857&WIDTH=256&HEIGHT=256` +
    `&BBOX={bbox-epsg-3857}`
  )
}

/**
 * Reads the drought class at a point off the CDI raster.
 *
 * GetFeatureInfo is not an option here — this service answers any such request
 * with "Invalid request type" — so we classify the rendered pixel against the
 * published legend instead.
 */
export async function getDroughtStatus(coords: Coordinates): Promise<DroughtStatus> {
  const today = new Date().toISOString().split('T')[0]
  const unknown: DroughtStatus = {
    level: 'unknown',
    label: 'unknown',
    updatedAt: today,
    source: 'Copernicus EDO',
  }

  try {
    const px = await samplePixel(sampleUrl(EDO_WMS, CDI_LAYER, coords.lng, coords.lat))
    // Outside the coverage the raster is simply not painted.
    if (px.a === 0) return unknown
    const level = nearestColour(px, CDI_PALETTE)
    if (!level || level === 'unknown') return unknown
    return { level, label: level, updatedAt: today, source: 'Copernicus EDO' }
  } catch {
    return unknown
  }
}
