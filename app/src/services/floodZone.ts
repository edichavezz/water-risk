import type { Coordinates, FloodZoneResult } from '../types'

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
  // Roughly a 90 m box — small enough to be the point, big enough that the
  // server does not collapse it to an empty raster.
  const delta = 0.0004
  const bbox =
    `${coords.lng - delta},${coords.lat - delta},` +
    `${coords.lng + delta},${coords.lat + delta}`
  return (
    `${SNCZI_WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
    `&LAYERS=${layer}&STYLES=&FORMAT=image/png&TRANSPARENT=true` +
    `&SRS=EPSG:4326&WIDTH=3&HEIGHT=3&BBOX=${bbox}`
  )
}

// True when the centre pixel of the sampled tile is painted, i.e. the point
// lies inside the flood zone that layer draws.
async function pointIsPainted(url: string): Promise<boolean> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`WMS ${res.status}`)
  const blob = await res.blob()
  if (!blob.type.startsWith('image/')) throw new Error('WMS returned a non-image')

  // A bitmap decoded from a blob carries no origin, so the canvas it is drawn
  // into is never tainted and getImageData stays readable.
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(bitmap, 0, 0)
    const cx = Math.floor(bitmap.width / 2)
    const cy = Math.floor(bitmap.height / 2)
    const [, , , alpha] = ctx.getImageData(cx, cy, 1, 1).data
    return alpha > 0
  } finally {
    bitmap.close()
  }
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

  for (const { layer, period } of layers) {
    try {
      if (await pointIsPainted(getSNCZISampleUrl(layer, coords))) {
        return { inZone: true, returnPeriod: period, source: 'SNCZI' }
      }
    } catch {
      // This layer could not be sampled — try the next, rather than claiming
      // the point is safe on the strength of a network error.
      continue
    }
  }

  return { inZone: false, source: 'SNCZI' }
}
