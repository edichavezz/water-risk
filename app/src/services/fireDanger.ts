import type { Coordinates, FireDangerResult, FireDangerClass } from '../types'
import { samplePixel, sampleUrl, nearestColour } from './wmsSample'

/**
 * EFFIS fire danger, from the JRC's own WMS.
 *
 * Two things about this endpoint are worth writing down, because both cost time
 * to discover:
 *
 * 1. **It is fetched directly, not through the WMS proxy.** Unlike Copernicus
 *    EDO — which sends `Access-Control-Allow-Origin: *` twice and so fails every
 *    CORS-mode fetch — this service sends exactly one well-formed header
 *    (verified 2026-07 with an explicit Origin). Routing it through the proxy
 *    would add a hop for nothing.
 * 2. **The layer is `ecmwf007.fwi`, not `ecmwf.fwi.fwi`.** The latter is
 *    advertised in GetCapabilities and answers 200 for every date, but returns
 *    an empty raster — 243 bytes, nothing painted, at every date tried. The
 *    0.07-degree variant is the one carrying data.
 */
const EFFIS_WMS = 'https://ies-ows.jrc.ec.europa.eu/effis'
const FWI_LAYER = 'ecmwf007.fwi'

/**
 * The six danger classes, read from this layer's own GetLegendGraphic.
 *
 * Do not pass a TIME: the advertised extent (2018-01-01/2099-12-31) is a schema
 * artefact rather than a real range, and naming a date does not change what is
 * returned. The service serves its own current slice.
 */
const FWI_PALETTE: { rgb: [number, number, number]; value: FireDangerClass }[] = [
  { rgb: [145, 252, 170], value: 'low' },
  { rgb: [210, 225, 74], value: 'moderate' },
  { rgb: [241, 179, 0], value: 'high' },
  { rgb: [231, 117, 0], value: 'very_high' },
  { rgb: [192, 0, 12], value: 'extreme' },
  { rgb: [58, 0, 21], value: 'very_extreme' },
]

/** Raster tile template for the map overlay. */
export function getFireDangerWmsUrl(): string {
  return (
    `${EFFIS_WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
    `&LAYERS=${FWI_LAYER}&STYLES=&FORMAT=image/png&TRANSPARENT=true` +
    `&SRS=EPSG:3857&WIDTH=256&HEIGHT=256` +
    `&BBOX={bbox-epsg-3857}`
  )
}

export const FIRE_DANGER_PALETTE = FWI_PALETTE

/**
 * Reads the fire danger class at a point off the rendered FWI raster.
 *
 * Same approach as drought, for the same reason: EFFIS `GetFeatureInfo` answers
 * "Search returned no results" for every query tried, at every date, so the
 * painted pixel is the only faithful reading.
 *
 * This is the *published forecast class*, not a number we computed. Nothing
 * here should ever be presented as a measured index.
 */
export async function getFireDanger(coords: Coordinates): Promise<FireDangerResult> {
  const today = new Date().toISOString().split('T')[0]
  const unknown: FireDangerResult = {
    danger: 'unknown',
    forDate: today,
    source: 'Copernicus EFFIS',
  }

  try {
    const px = await samplePixel(sampleUrl(EFFIS_WMS, FWI_LAYER, coords.lng, coords.lat))
    // Outside the model domain — sea, or beyond the grid — nothing is painted.
    if (px.a === 0) return unknown
    const danger = nearestColour(px, FWI_PALETTE)
    if (!danger) return unknown
    return { danger, forDate: today, source: 'Copernicus EFFIS' }
  } catch {
    return unknown
  }
}
