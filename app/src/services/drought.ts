import type { Coordinates, DroughtStatus } from '../types'
import { samplePixel, sampleUrl, nearestColour, anyPixelPainted } from './wmsSample'
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
 * The CDI palette, read from the layer's own GetLegendGraphic.
 *
 * NOTE (verified 2026-07): the legend for `cdiad` lists exactly three swatches
 * — Watch, Warning, Alert. It carries no "normal", no recovery classes and no
 * "no data" grey, and none of those colours appear anywhere in the raster: a
 * 256 px tile over the whole of Spain, and another over central Europe, decode
 * to these three colours plus fully transparent and nothing else.
 *
 * So the layer paints drought and leaves everything else unpainted, and an
 * unpainted land pixel means "no drought class in force" rather than "no data".
 * `getDroughtStatus` depends on that, which is why the palette must not list
 * classes the service never renders — a stray entry here would let a
 * nearest-colour match invent a class that cannot occur.
 *
 * It is the Okabe-Ito colourblind-safe set, so the three are far apart in RGB
 * and the match is unambiguous.
 */
const CDI_PALETTE: { rgb: [number, number, number]; value: DroughtStatus['level'] }[] = [
  { rgb: [240, 228, 66], value: 'watch' },
  { rgb: [230, 159, 0], value: 'warning' },
  { rgb: [220, 5, 12], value: 'alert' },
]

/**
 * A wide tile over Iberia, used once per session to prove the layer is
 * actually rendering before an unpainted point is read as "no drought".
 *
 * Without this, any blank response — a proxy fault that still returns a valid
 * PNG, a renamed layer, a TIME slice that draws nothing — would become a
 * confident "conditions are normal", which is the dead-service-reads-as-safety
 * failure this codebase already fixed for the flood layers. At this extent the
 * CDI has never been uniformly clear, so "some pixel is painted" is a fair
 * liveness test; being wrong about it costs a reading of `unknown`, which is
 * the honest fallback anyway.
 */
const SENTINEL_BBOX = '-10,36,4,44'

let sentinelCache: Promise<boolean> | null = null

async function layerIsRendering(): Promise<boolean> {
  if (!sentinelCache) {
    sentinelCache = (async () => {
      try {
        const slice = await getLatestSlice()
        const url =
          `${EDO_WMS}&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
          `&LAYERS=${CDI_LAYER}&STYLES=&FORMAT=image/png&TRANSPARENT=true` +
          `&SRS=EPSG:4326&WIDTH=64&HEIGHT=64&BBOX=${SENTINEL_BBOX}` +
          (slice ? `&TIME=${encodeURIComponent(slice)}` : '')
        return await anyPixelPainted(url)
      } catch {
        return false
      }
    })()
  }
  return sentinelCache
}

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
  sentinelCache = null
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

    // An unpainted pixel is "no drought class in force" — the layer draws only
    // Watch, Warning and Alert (see CDI_PALETTE). Reporting that as unknown is
    // what made most of Andalucía show "no data" on a working feed while the
    // real answer was that conditions are normal.
    //
    // It is only reported as `none` once the layer is known to be rendering,
    // though: an empty raster from a broken service looks identical at one
    // pixel, and "no drought" is the reading a user would most want to trust.
    if (px.a === 0) return (await layerIsRendering()) ? { level: 'none', label: 'none', ...base } : unknown

    const level = nearestColour(px, CDI_PALETTE)
    if (!level) return unknown
    return { level, label: level, ...base }
  } catch {
    return unknown
  }
}
