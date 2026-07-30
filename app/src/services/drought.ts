import type { Coordinates, DroughtStatus } from '../types'
import { samplePixel, sampleUrl, nearestColour } from './wmsSample'
import { parseLatestSlice, stalenessOf, findServedSlice } from './droughtSlice'

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

/**
 * Combined Drought Indicator v4.1.
 *
 * `cdiad`, not `cdinx`: they are the same indicator at the same version, with a
 * byte-identical legend palette, but cdinx's time dimension stopped at
 * 2024-01-01 while cdiad is still published. The app rendered cdinx and stamped
 * today's date on it, presenting a ~2.6-year-old slice as current.
 */
const CDI_LAYER = 'cdiad'

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

/**
 * Tile URL for the map layer. TIME is left off deliberately: the layer is added
 * before any slice has been resolved, and the service's own default is its
 * newest slice — the same one `findServedSlice` settles on — so the raster and
 * the dated reading agree without threading async state into layer setup.
 */
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
/**
 * The slice date the service is serving, cached for the session.
 *
 * Read from the layer's own time dimension rather than assumed. Cached because
 * it is one document per session and every card would otherwise refetch it.
 */
let sliceCache: { value: string | null } | null = null

/** Does the service actually serve this slice? */
async function sliceExists(date: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${sampleUrl(EDO_WMS, CDI_LAYER, -5.0, 37.0)}&TIME=${encodeURIComponent(date)}`,
    )
    return res.ok
  } catch {
    return false
  }
}

/**
 * The slice the app will render and date the reading from.
 *
 * Probed rather than taken from the capabilities document, because the
 * advertised extent understates: cdiad declares an end of 2026-02-21 while
 * serving 2026-06-01, and dating a current reading five months stale would be
 * its own kind of wrong. The advertised end is the fallback when probing finds
 * nothing, which is what correctly marks a genuinely abandoned feed as ancient.
 */
export async function getLatestSlice(): Promise<string | null> {
  if (sliceCache) return sliceCache.value

  const served = await findServedSlice(sliceExists)
  if (served) {
    sliceCache = { value: served }
    return served
  }

  try {
    const res = await fetch(`${EDO_WMS}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`)
    if (!res.ok) throw new Error(String(res.status))
    sliceCache = { value: parseLatestSlice(await res.text(), CDI_LAYER) }
  } catch {
    // Unknown, not today: a failure here must not manufacture a fresh date.
    sliceCache = { value: null }
  }
  return sliceCache.value
}

/** Test seam — the cache would otherwise leak between cases. */
export function resetSliceCache(): void {
  sliceCache = null
}

export async function getDroughtStatus(coords: Coordinates): Promise<DroughtStatus> {
  const slice = await getLatestSlice()
  const { stale, ageDays } = stalenessOf(slice)
  const base = { updatedAt: slice, stale, ageDays, source: 'Copernicus EDO' } as const
  const unknown: DroughtStatus = { level: 'unknown', label: 'unknown', ...base }

  try {
    // TIME is pinned to the slice just dated, so the number on the card and the
    // pixel it came from are provably the same slice rather than whatever the
    // service chose between the two calls.
    const url = sampleUrl(EDO_WMS, CDI_LAYER, coords.lng, coords.lat)
    const px = await samplePixel(slice ? `${url}&TIME=${encodeURIComponent(slice)}` : url)
    // Outside the coverage the raster is simply not painted.
    if (px.a === 0) return unknown
    const level = nearestColour(px, CDI_PALETTE)
    if (!level || level === 'unknown') return unknown
    return { level, label: level, ...base }
  } catch {
    return unknown
  }
}
