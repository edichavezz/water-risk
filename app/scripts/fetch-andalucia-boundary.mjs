/**
 * Rebuilds `src/data/andalucia-boundary.json` from OpenStreetMap.
 *
 * The boundary it replaces was a 24-point hand-drawn ring. It cut real
 * territory: Tarifa — mainland Spain's southernmost town, unambiguously in
 * Cádiz — fell outside it, so `lookupCoverage` told people there that the app
 * did not cover their area. A sketch cannot be corrected point by point, so
 * this takes the real administrative boundary (OSM relation 349044) and
 * simplifies it just enough to bundle.
 *
 *   node scripts/fetch-andalucia-boundary.mjs
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OSM_RELATION = 349044
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/data/andalucia-boundary.json')

// Coarse enough to bundle, fine enough to keep the coastline and the province
// corners where they belong. Verified against the checks below.
const TOLERANCE = 0.004

/** Perpendicular distance from p to the segment a-b, in degrees. */
function segmentDistance(p, a, b) {
  const [px, py] = p
  const [ax, ay] = a
  const [bx, by] = b
  const dx = bx - ax
  const dy = by - ay
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Douglas-Peucker. Keeps the ring closed. */
function simplify(points, tolerance) {
  if (points.length < 3) return points
  let maxDist = 0
  let index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = segmentDistance(points[i], points[0], points[points.length - 1])
    if (d > maxDist) {
      maxDist = d
      index = i
    }
  }
  if (maxDist <= tolerance) return [points[0], points[points.length - 1]]
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ]
}

function simplifyRing(ring, tolerance) {
  const out = simplify(ring, tolerance)
  // A ring needs at least 4 positions with the first repeated at the end.
  if (out.length < 4) return ring
  const [first] = out
  const last = out[out.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) out.push(first)
  return out
}

// Points that must land the right way round after simplification. Tarifa is
// the regression this file exists for.
const MUST_BE_INSIDE = [
  ['Tarifa', -5.6035, 36.0143],
  ['Sevilla', -5.9845, 37.3891],
  ['Almería', -2.4637, 36.8340],
  ['Huelva', -6.9447, 37.2614],
  ['Jaén', -3.7900, 37.7796],
  ['Marbella', -4.8858, 36.5099],
]
const MUST_BE_OUTSIDE = [
  ['Cartagena (Murcia)', -0.9862, 37.6057],
  ['Valencia', -0.3763, 39.4699],
  ['Badajoz (Extremadura)', -6.9706, 38.8794],
  ['Ciudad Real (Castilla-La Mancha)', -3.9270, 38.9848],
]

/** Ray casting against a GeoJSON Polygon or MultiPolygon. */
function contains(geometry, lng, lat) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  for (const poly of polys) {
    let inside = false
    for (const [r, ring] of poly.entries()) {
      let hit = false
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit
      }
      // Ring 0 is the outer boundary; the rest are holes.
      if (r === 0) inside = hit
      else if (hit) inside = false
    }
    if (inside) return true
  }
  return false
}

const res = await fetch(
  `https://nominatim.openstreetmap.org/lookup?osm_ids=R${OSM_RELATION}&format=json&polygon_geojson=1`,
  { headers: { 'User-Agent': 'aguariesgo/1.0 (coverage boundary build)' } },
)
if (!res.ok) throw new Error(`Nominatim lookup failed: ${res.status}`)
const [place] = await res.json()
if (!place?.geojson) throw new Error('no geometry returned')

const raw = place.geojson
const polys = raw.type === 'Polygon' ? [raw.coordinates] : raw.coordinates
const rawPoints = polys.flat(2).length

// Islands and slivers are dropped — the mainland region is what the app
// covers, and keeping every rock triples the file for no coverage gain.
const simplified = polys
  .map(poly => poly.map(ring => simplifyRing(ring, TOLERANCE)).filter(ring => ring.length >= 4))
  .filter(poly => poly.length > 0)
  .filter(poly => poly[0].length >= 20)

const geometry =
  simplified.length === 1
    ? { type: 'Polygon', coordinates: simplified[0] }
    : { type: 'MultiPolygon', coordinates: simplified }

const feature = {
  type: 'Feature',
  properties: {
    name: 'Andalucía',
    source: `OpenStreetMap relation ${OSM_RELATION} (ODbL)`,
    simplifiedToleranceDegrees: TOLERANCE,
    generatedAt: new Date().toISOString().slice(0, 10),
  },
  geometry,
}

let failed = false
for (const [name, lng, lat] of MUST_BE_INSIDE) {
  const ok = contains(geometry, lng, lat)
  if (!ok) failed = true
  console.log(`${ok ? 'ok  ' : 'FAIL'}  inside   ${name}`)
}
for (const [name, lng, lat] of MUST_BE_OUTSIDE) {
  const ok = !contains(geometry, lng, lat)
  if (!ok) failed = true
  console.log(`${ok ? 'ok  ' : 'FAIL'}  outside  ${name}`)
}

const points = simplified.flat(2).length
console.log(`\n${rawPoints} points → ${points} after simplification (${geometry.type})`)
if (failed) {
  console.error('\nRefusing to write: a coverage check failed. Lower TOLERANCE and retry.')
  process.exit(1)
}

writeFileSync(OUT, JSON.stringify(feature))
console.log(`wrote ${OUT}`)
