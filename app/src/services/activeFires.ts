import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import type {
  ActiveFireConfidence,
  ActiveFireDetection,
  ActiveFireDetectionType,
  ActiveFireResult,
  Coordinates,
} from '../types'

const GIBS_LAYER = 'VIIRS_NOAA20_Thermal_Anomalies_375m_All'
const GIBS_ROOT = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best'
const TILE_MATRIX = '500m'
const TILE_ZOOM = 7
const MATRIX_WIDTH = 160
const MATRIX_HEIGHT = 80
const KM_PER_DEG = 111.32
const DEFAULT_RADIUS_KM = 30
const WINDOW_HOURS = 24

interface TileCoordinate { row: number; col: number }

interface GibsProperties {
  LATITUDE?: unknown
  LONGITUDE?: unknown
  ACQ_DATE?: unknown
  ACQ_TIME?: unknown
  SATELLITE?: unknown
  CONFIDENCE?: unknown
  TYPE?: unknown
  UID?: unknown
  FRP?: unknown
}

const isoDay = (date: Date): string => date.toISOString().slice(0, 10)

function utcDayBefore(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 1,
  ))
}

function distanceKm(a: Coordinates, b: Coordinates): number {
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180)
  // Normalize across the antimeridian: 179.9° to -179.9° is 0.2°, not 359.8°.
  const deltaLng = ((b.lng - a.lng + 540) % 360) - 180
  const dx = deltaLng * Math.cos(midLat) * KM_PER_DEG
  const dy = (b.lat - a.lat) * KM_PER_DEG
  return Math.hypot(dx, dy)
}

/** EPSG:4326 GIBS tiles intersecting a circular search's bounding box. */
export function gibsTileCoordinates(
  coords: Coordinates,
  radiusKm = DEFAULT_RADIUS_KM,
): TileCoordinate[] {
  const dLat = radiusKm / KM_PER_DEG
  const cosLat = Math.max(Math.cos((coords.lat * Math.PI) / 180), 0.01)
  const dLng = radiusKm / (KM_PER_DEG * cosLat)
  const north = Math.min(90, coords.lat + dLat)
  const south = Math.max(-90, coords.lat - dLat)
  const tileWidth = 360 / MATRIX_WIDTH
  const tileHeight = 180 / MATRIX_HEIGHT
  const minRawCol = Math.floor((coords.lng - dLng + 180) / tileWidth)
  const maxRawCol = Math.floor((coords.lng + dLng + 180) / tileWidth)
  const minRow = Math.max(0, Math.floor((90 - north) / tileHeight))
  const maxRow = Math.min(MATRIX_HEIGHT - 1, Math.floor((90 - south) / tileHeight))

  const tiles: TileCoordinate[] = []
  const seen = new Set<string>()
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let rawCol = minRawCol; rawCol <= maxRawCol; rawCol += 1) {
      const col = ((rawCol % MATRIX_WIDTH) + MATRIX_WIDTH) % MATRIX_WIDTH
      const key = `${row}:${col}`
      if (seen.has(key)) continue
      seen.add(key)
      tiles.push({ row, col })
    }
  }
  return tiles
}

export function gibsDetectionTileUrl(day: string, tile: TileCoordinate): string {
  return (
    `${GIBS_ROOT}/${GIBS_LAYER}/default/${day}/${TILE_MATRIX}` +
    `/${TILE_ZOOM}/${tile.row}/${tile.col}.mvt`
  )
}

function acquisitionTimestamp(date: unknown, time: unknown): string | null {
  if (typeof date !== 'string' || typeof time !== 'string') return null
  const digits = time.replace(':', '').padStart(4, '0')
  if (!/^\d{4}$/.test(digits) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const hh = digits.slice(0, 2)
  const mm = digits.slice(2, 4)
  const stamp = `${date}T${hh}:${mm}:00Z`
  return Number.isNaN(Date.parse(stamp)) ? null : stamp
}

function confidence(value: unknown): ActiveFireConfidence {
  const v = String(value ?? '').toLowerCase()
  if (v === 'low' || v === 'l') return 'low'
  if (v === 'nominal' || v === 'n') return 'nominal'
  if (v === 'high' || v === 'h') return 'high'
  return 'unknown'
}

function detectionType(value: unknown): ActiveFireDetectionType {
  switch (String(value ?? '')) {
    case '0': return 'vegetation'
    case '1': return 'volcano'
    case '2': return 'other'
    case '3': return 'offshore'
    default: return 'unknown'
  }
}

function satelliteName(value: unknown): string {
  switch (String(value ?? '')) {
    case 'N20': return 'NOAA-20'
    case 'N21': return 'NOAA-21'
    case 'N': return 'Suomi-NPP'
    default: return String(value ?? 'VIIRS')
  }
}

function detectionFromProperties(p: GibsProperties): ActiveFireDetection | null {
  const lat = Number(p.LATITUDE)
  const lng = Number(p.LONGITUDE)
  const detectedAt = acquisitionTimestamp(p.ACQ_DATE, p.ACQ_TIME)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !detectedAt) return null
  const satellite = satelliteName(p.SATELLITE)
  const uid = String(p.UID ?? `${lat},${lng},${p.ACQ_TIME ?? ''}`)
  const frp = Number(p.FRP)
  return {
    id: `${satellite}:${detectedAt.slice(0, 10)}:${uid}`,
    detectedAt,
    lat,
    lng,
    distanceKm: 0,
    confidence: confidence(p.CONFIDENCE),
    satellite,
    type: detectionType(p.TYPE),
    frpMw: Number.isFinite(frp) ? frp : undefined,
  }
}

/** Decode every FIRMS feature layer in one NASA GIBS MVT response. */
export function decodeDetectionTile(buffer: ArrayBuffer): ActiveFireDetection[] {
  if (buffer.byteLength === 0) return []
  const tile = new VectorTile(new Pbf(new Uint8Array(buffer)))
  const detections: ActiveFireDetection[] = []
  for (const layer of Object.values(tile.layers)) {
    for (let i = 0; i < layer.length; i += 1) {
      const detection = detectionFromProperties(layer.feature(i).properties as GibsProperties)
      if (detection) detections.push(detection)
    }
  }
  return detections
}

/** Apply the semantic filters the square tile query cannot express. */
export function filterRecentDetections(
  detections: ActiveFireDetection[],
  coords: Coordinates,
  radiusKm = DEFAULT_RADIUS_KM,
  now = new Date(),
): ActiveFireDetection[] {
  const end = now.getTime()
  const start = end - WINDOW_HOURS * 60 * 60 * 1000
  const seen = new Set<string>()
  const out: ActiveFireDetection[] = []

  for (const detection of detections) {
    const observed = Date.parse(detection.detectedAt)
    if (observed < start || observed > end) continue
    // TYPE is optional in the NRT product. Keep an unknown classification, but
    // reject a point NASA explicitly identifies as a volcano/static/offshore.
    if (!['vegetation', 'unknown'].includes(detection.type)) continue
    const km = distanceKm(coords, detection)
    if (km > radiusKm || seen.has(detection.id)) continue
    seen.add(detection.id)
    out.push({ ...detection, distanceKm: Math.round(km * 10) / 10 })
  }

  return out.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
}

/**
 * Recent VIIRS thermal anomalies around a point.
 *
 * Today and yesterday are both fetched because a rolling 24-hour window
 * straddles UTC midnight. A failed tile rejects the whole answer: partial data
 * must never be shown as a trustworthy zero.
 */
export async function getRecentFireDetections(
  coords: Coordinates,
  now = new Date(),
  radiusKm = DEFAULT_RADIUS_KM,
): Promise<ActiveFireResult> {
  const days = [isoDay(now), isoDay(utcDayBefore(now))]
  const requests = days.flatMap(day =>
    gibsTileCoordinates(coords, radiusKm).map(tile => ({ day, tile })),
  )
  const tiles = await Promise.all(requests.map(async ({ day, tile }) => {
    const res = await fetch(gibsDetectionTileUrl(day, tile))
    if (!res.ok) throw new Error(`NASA GIBS ${res.status}`)
    return decodeDetectionTile(await res.arrayBuffer())
  }))

  return {
    detections: filterRecentDetections(tiles.flat(), coords, radiusKm, now),
    radiusKm,
    windowHours: WINDOW_HOURS,
    through: now.toISOString(),
    source: 'NASA FIRMS',
  }
}
