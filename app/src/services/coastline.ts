import type { Coordinates } from '../types'
import coastline from '../data/coastline.generated.json'

const POINTS = coastline.points as [number, number][]
const KM_PER_DEG = 111.32

/**
 * Distance from `coords` to the nearest sampled coastline point, in km.
 *
 * Equirectangular rather than haversine: over the few hundred kilometres this
 * is ever asked about, the error is well under the ~5 km slack the sampling
 * already carries, and it keeps a 5,000-point scan to well under a millisecond.
 *
 * Returns Infinity outside the generated bounding box, where we hold no
 * coastline at all — the honest answer is "we don't know", and every caller
 * treats a large distance as "don't offer the coastal datasets here".
 */
export function distanceToCoastKm(coords: Coordinates): number {
  const latRad = (coords.lat * Math.PI) / 180
  const cosLat = Math.cos(latRad)

  let best = Infinity
  for (let i = 0; i < POINTS.length; i++) {
    const dx = (POINTS[i][0] - coords.lng) * cosLat * KM_PER_DEG
    const dy = (POINTS[i][1] - coords.lat) * KM_PER_DEG
    const d = dx * dx + dy * dy
    if (d < best) best = d
  }
  return Math.sqrt(best)
}

/**
 * Whether the coastal datasets are worth offering here.
 *
 * This replaces `isCoastalProvincia`, a hardcoded list of Spanish province
 * names that could not answer the question in France or Italy, and got it
 * wrong at home: Nominatim returns no `county` for Seville, so the province
 * read as "Andalucía" and never matched the list.
 *
 * 30 km is deliberately generous. The question is "might the reader care about
 * the coast", not "is this a beach" — and being wrong in the inclusive
 * direction shows an extra row that reports its own result honestly, while
 * being wrong the other way hides a hazard with no trace.
 */
export function isCoastal(coords: Coordinates, withinKm = 30): boolean {
  return distanceToCoastKm(coords) <= withinKm
}
