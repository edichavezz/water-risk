/**
 * Reads a single pixel out of a WMS raster.
 *
 * Several of the services this app draws from publish their data only as
 * rendered rasters — GetFeatureInfo is either unsupported (Copernicus EDO
 * answers "Invalid request type") or returns coverage sentinels that do not
 * track what is drawn (IDEE's flood layers). In both cases the painted pixel
 * is the only faithful reading, so we ask for a tiny image centred on the
 * point and inspect the middle of it.
 */

export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** Builds a GetMap URL for a ~3x3 px image centred on a lng/lat. */
export function sampleUrl(
  endpoint: string,
  layer: string,
  lng: number,
  lat: number,
  // Roughly 90 m at Spain's latitude — small enough to be "the point", big
  // enough that the server does not collapse it to an empty raster.
  delta = 0.0004,
): string {
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`
  // The endpoint may already carry a query string — the proxy takes its
  // upstream that way.
  const sep = endpoint.includes('?') ? '&' : '?'
  return (
    `${endpoint}${sep}SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
    `&LAYERS=${encodeURIComponent(layer)}&STYLES=&FORMAT=image/png&TRANSPARENT=true` +
    `&SRS=EPSG:4326&WIDTH=3&HEIGHT=3&BBOX=${bbox}`
  )
}

/** Fetches `url` and returns the colour of its centre pixel. */
export async function samplePixel(url: string): Promise<Rgba> {
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
    const [r, g, b, a] = ctx.getImageData(cx, cy, 1, 1).data
    return { r, g, b, a }
  } finally {
    bitmap.close()
  }
}

/**
 * True when any pixel of the image at `url` is painted.
 *
 * Used as a liveness check: a service that answers with a valid but entirely
 * empty raster is indistinguishable, at one point, from a service correctly
 * reporting nothing there. Over a wide enough area the difference is decidable,
 * so a caller that wants to read "unpainted" as a real answer can ask this
 * first.
 */
export async function anyPixelPainted(url: string): Promise<boolean> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`WMS ${res.status}`)
  const blob = await res.blob()
  if (!blob.type.startsWith('image/')) throw new Error('WMS returned a non-image')

  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true
    return false
  } finally {
    bitmap.close()
  }
}

/** Nearest palette entry to `px`, or null when nothing is within `tolerance`. */
export function nearestColour<T>(
  px: Rgba,
  palette: { rgb: [number, number, number]; value: T }[],
  tolerance = 60,
): T | null {
  let best: T | null = null
  let bestDistance = Infinity
  for (const { rgb, value } of palette) {
    const d = Math.hypot(px.r - rgb[0], px.g - rgb[1], px.b - rgb[2])
    if (d < bestDistance) {
      bestDistance = d
      best = value
    }
  }
  return bestDistance <= tolerance ? best : null
}
