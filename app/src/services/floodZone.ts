import type { Coordinates, FloodZoneResult } from '../types'
import { samplePixel, sampleUrl } from './wmsSample'

// SNCZI flood zones, served through the IDEE INSPIRE endpoint.
//
// The old host (wms.mapama.gob.es/sig/Agua/ZonasInundables/wms.aspx) now
// answers every request — GetMap and GetCapabilities alike — with a
// NullReferenceException wrapped in a ServiceExceptionReport, so both the map
// rasters and the point query were silently failing. This endpoint serves the
// same SNCZI data, is queryable, and sends `Access-Control-Allow-Origin: *`.
const SNCZI_WMS = 'https://servicios.idee.es/wms-inspire/riesgos-naturales/inundaciones'

export const SNCZI_LAYERS = {
  T10: 'NZ.Flood.FluvialT10',
  T100: 'NZ.Flood.FluvialT100',
  T500: 'NZ.Flood.FluvialT500',
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

/**
 * URL for a tiny PNG centred on `coords`, used to sample whether the point
 * falls inside a flood zone.
 *
 * GetFeatureInfo cannot answer that question on this service: the layers are
 * raster coverages, so every query returns one feature carrying a `GRAY_INDEX`
 * float. Those values do not track the zones — a point on the Guadalquivir
 * bank (visibly inside T500) and a point well inland both come back as
 * -3.4e38. The rendered pixel is the only faithful signal, so we ask for a 3x3
 * image and read the centre.
 */
export function getSNCZISampleUrl(layer: string, coords: Coordinates): string {
  return sampleUrl(SNCZI_WMS, layer, coords.lng, coords.lat)
}

// True when the centre pixel of the sampled tile is painted, i.e. the point
// lies inside the flood zone that layer draws.
async function pointIsPainted(url: string): Promise<boolean> {
  return (await samplePixel(url)).a > 0
}

/**
 * Reports the worst flood return period covering `coords`, by sampling the
 * same rasters the map draws — so the panel and the map can never disagree.
 */
export async function getFloodZoneStatus(coords: Coordinates): Promise<FloodZoneResult> {
  // Worst (most frequent) period first: a point inside T10 is inside all three.
  const layers = [
    { layer: SNCZI_LAYERS.T10, period: '10' as const },
    { layer: SNCZI_LAYERS.T100, period: '100' as const },
    { layer: SNCZI_LAYERS.T500, period: '500' as const },
  ]

  let sampled = false
  let lastError: unknown

  for (const { layer, period } of layers) {
    try {
      if (await pointIsPainted(getSNCZISampleUrl(layer, coords))) {
        return { inZone: true, returnPeriod: period, source: 'SNCZI' }
      }
      sampled = true
    } catch (e) {
      // One failed layer is survivable — the others still answer.
      lastError = e
    }
  }

  // Nothing answered. Reporting "not in a flood zone" here would repeat the
  // failure this endpoint move fixed: a dead service reading as safety. Throw
  // so the dataset surfaces as an error instead.
  if (!sampled) throw lastError ?? new Error('SNCZI flood zones could not be sampled')

  return { inZone: false, source: 'SNCZI' }
}
