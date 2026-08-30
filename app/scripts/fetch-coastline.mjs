/**
 * Builds `src/data/coastline.generated.json` — the point set behind
 * `isCoastal()`.
 *
 * Replaces a hardcoded list of Spanish province names, which could not answer
 * the question in France or Italy and got Seville wrong at home. Geometry
 * generalises; name lists do not.
 *
 * The output is deliberately coarse. It is only ever asked "is this point
 * within N km of the sea", so a vertex every ~10 km costs at most ~5 km of
 * slack on a 30 km threshold, and keeps the bundled file to ~28 KB gzipped.
 *
 * Run: npm run fetch:coastline
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_coastline.geojson'

// Iberia and the Atlantic French coast through to the eastern Mediterranean.
// Wider than the Mediterranean proper because France and Spain both have
// Atlantic coastline that a reader would expect us to recognise.
export const BBOX = { west: -12, south: 30, east: 37, north: 52 }

/**
 * Vertex spacing along the coast, in kilometres.
 *
 * 10 km rather than 5 halves the bundled file (~200 KB raw, ~60 KB gzipped)
 * and costs at most ~5 km of slack on the threshold. That is the right trade
 * for a question whose answer is "should we even offer this dataset here" —
 * nothing downstream reports the distance to the reader.
 */
const SPACING_KM = 10
const KM_PER_DEG = 111.32

const inBox = ([lng, lat]) =>
  lng >= BBOX.west && lng <= BBOX.east && lat >= BBOX.south && lat <= BBOX.north

function segmentKm([lng1, lat1], [lng2, lat2]) {
  const midLat = ((lat1 + lat2) / 2) * (Math.PI / 180)
  const dx = (lng2 - lng1) * Math.cos(midLat) * KM_PER_DEG
  const dy = (lat2 - lat1) * KM_PER_DEG
  return Math.hypot(dx, dy)
}

/**
 * Resamples a line to one point roughly every `spacingKm`, both adding points
 * across long straight runs and dropping the dense detail Natural Earth
 * carries around rias and harbours.
 *
 * Both halves matter. Without interpolation, a long straight segment would
 * contribute only its endpoints and a point off its middle would read as
 * inland. Without decimation, the source's own vertex density dominates and
 * the spacing parameter buys nothing — the file stays the same size however
 * coarse you ask for.
 */
export function resample(line, spacingKm = SPACING_KM) {
  if (line.length < 2) return [...line]

  const out = [line[0]]
  let carry = 0

  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]
    const b = line[i + 1]
    const len = segmentKm(a, b)
    if (len === 0) continue

    // Walk this segment, dropping a point each time the running distance since
    // the last emitted one reaches the spacing.
    let travelled = spacingKm - carry
    while (travelled <= len) {
      const f = travelled / len
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f])
      travelled += spacingKm
    }
    carry = (carry + len) % spacingKm
  }

  out.push(line[line.length - 1])
  return out
}

/** Rounds to ~110 m and drops duplicates, which resampling produces freely. */
export function quantise(points) {
  const seen = new Set()
  const out = []
  for (const [lng, lat] of points) {
    const q = [Math.round(lng * 1000) / 1000, Math.round(lat * 1000) / 1000]
    const key = `${q[0]},${q[1]}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(q)
  }
  return out
}

export function buildCoastline(geojson) {
  const points = []
  for (const f of geojson.features) {
    const lines =
      f.geometry.type === 'LineString'
        ? [f.geometry.coordinates]
        : f.geometry.type === 'MultiLineString'
          ? f.geometry.coordinates
          : []
    for (const line of lines) {
      // Clip first: densifying the whole planet then discarding it is slow.
      if (!line.some(inBox)) continue
      points.push(...resample(line).filter(inBox))
    }
  }
  return quantise(points)
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url))
  const out = join(here, '..', 'src', 'data', 'coastline.generated.json')

  let geojson
  try {
    const res = await fetch(SOURCE)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    geojson = await res.json()
  } catch (e) {
    // Same discipline as fetch-reservoirs: a stale coastline is fine, a
    // truncated one silently moves the shoreline.
    console.error(`Natural Earth fetch failed: ${e.message}`)
    if (existsSync(out)) {
      console.error('Keeping the existing coastline file.')
      process.exit(0)
    }
    process.exit(1)
  }

  const points = buildCoastline(geojson)
  const previous = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')).points.length : 0
  if (previous && points.length < previous * 0.9) {
    console.error(
      `Refusing to write: ${points.length} points vs ${previous} previously. ` +
        'A partial coastline moves the shoreline inland without any error.',
    )
    process.exit(1)
  }

  writeFileSync(
    out,
    JSON.stringify({
      source: 'Natural Earth 10m coastline (public domain)',
      bbox: BBOX,
      spacingKm: SPACING_KM,
      fetchedAt: new Date().toISOString().slice(0, 10),
      points,
    }),
  )
  console.log(`Wrote ${points.length} coastline points`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
