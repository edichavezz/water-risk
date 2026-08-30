import type { Coordinates, FireHistoryResult, BurntArea } from '../types'

/**
 * Burnt-area perimeters from EFFIS, via WFS as GeoJSON.
 *
 * `ms:modis.ba.poly` is the multi-year archive; the `.season` suffix restricts
 * to the current season, which is too narrow to answer "has this area burned
 * before". Verified against a live query near Ronda: 42 perimeters from 2016
 * onward, each carrying a date, an area in hectares, and the commune it fell in.
 *
 * Fetched directly — this host sends a single well-formed CORS header.
 */
const EFFIS_WFS = 'https://maps.effis.emergency.copernicus.eu/effis'

/** The archive's earliest coverage, so "nothing found" can be scoped honestly. */
export const ARCHIVE_SINCE = 2012

const RADIUS_KM = 30
const KM_PER_DEG = 111.32

interface RawFeature {
  properties?: {
    FIREDATE?: string
    AREA_HA?: string
    COMMUNE?: string
    PROVINCE?: string
    PERCNA2K?: string
  }
  geometry?: { type: string; coordinates: unknown }
}

/** Rough centroid of a polygon or multipolygon ring set. */
export function centroidOf(geometry: RawFeature['geometry']): Coordinates | null {
  if (!geometry) return null
  // Walk to the deepest coordinate pairs, whatever the nesting depth.
  const points: [number, number][] = []
  const walk = (node: unknown) => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      points.push([node[0] as number, node[1] as number])
      return
    }
    for (const child of node) walk(child)
  }
  walk(geometry.coordinates)
  if (!points.length) return null
  const lng = points.reduce((s, p) => s + p[0], 0) / points.length
  const lat = points.reduce((s, p) => s + p[1], 0) / points.length
  return { lat, lng }
}

function distanceKm(a: Coordinates, b: Coordinates): number {
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180)
  const dx = (b.lng - a.lng) * Math.cos(midLat) * KM_PER_DEG
  const dy = (b.lat - a.lat) * KM_PER_DEG
  return Math.hypot(dx, dy)
}

/**
 * Turns the raw feature collection into burns near `coords`, most recent first.
 *
 * Exported so the parsing can be tested against a captured response without a
 * network call. The bbox is a square, so a corner is further away than the
 * radius — distances are computed and filtered here rather than trusted.
 */
export function shapeFires(
  features: RawFeature[],
  coords: Coordinates,
  radiusKm = RADIUS_KM,
): BurntArea[] {
  const out: BurntArea[] = []

  for (const f of features) {
    const p = f.properties ?? {}
    if (!p.FIREDATE) continue
    const centre = centroidOf(f.geometry)
    if (!centre) continue

    const km = distanceKm(coords, centre)
    if (km > radiusKm) continue

    const areaHa = Number(p.AREA_HA)
    const protectedPercent = p.PERCNA2K !== undefined ? Number(p.PERCNA2K) : undefined

    out.push({
      date: p.FIREDATE.split(' ')[0],
      areaHa: Number.isFinite(areaHa) ? Math.round(areaHa) : 0,
      commune: p.COMMUNE || undefined,
      province: p.PROVINCE || undefined,
      distanceKm: Math.round(km * 10) / 10,
      protectedPercent:
        protectedPercent !== undefined && Number.isFinite(protectedPercent)
          ? Math.round(protectedPercent)
          : undefined,
    })
  }

  return out.sort((a, b) => b.date.localeCompare(a.date))
}

export function fireHistoryQueryUrl(coords: Coordinates, radiusKm = RADIUS_KM): string {
  const dLat = radiusKm / KM_PER_DEG
  const dLng = radiusKm / (KM_PER_DEG * Math.cos((coords.lat * Math.PI) / 180))
  const bbox = [
    coords.lng - dLng,
    coords.lat - dLat,
    coords.lng + dLng,
    coords.lat + dLat,
  ].join(',')

  return (
    `${EFFIS_WFS}?service=WFS&version=1.1.0&request=GetFeature` +
    `&typename=ms:modis.ba.poly&outputformat=geojson&srsname=EPSG:4326&bbox=${bbox}`
  )
}

export async function getFireHistory(
  coords: Coordinates,
  radiusKm = RADIUS_KM,
): Promise<FireHistoryResult> {
  const res = await fetch(fireHistoryQueryUrl(coords, radiusKm))
  if (!res.ok) throw new Error(`EFFIS WFS ${res.status}`)
  const data: { features?: RawFeature[] } = await res.json()

  return {
    fires: shapeFires(data.features ?? [], coords, radiusKm),
    radiusKm,
    since: ARCHIVE_SINCE,
    source: 'Copernicus EFFIS',
  }
}
