/**
 * Builds `src/data/country-outlines.generated.json` — the polygons the entry
 * map paints for the countries the app holds national sources for.
 *
 * Kept separate from `andalucia-boundary.json`, which is a different claim:
 * that region has hand-curated supply systems and daily reservoir levels, and
 * is painted stronger. These outlines only say "national registers answer
 * here". Merging the two would make the legend lie.
 *
 * Run: npm run fetch:country-outlines
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { resample, quantise } from './fetch-coastline.mjs'

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'

/**
 * ISO 3166-1 alpha-2 codes, lowercased to match `PlaceContext.countryCode`.
 *
 * This list has to stay in step with the `applicability` predicates in
 * `src/registry/datasets.ts` — `coverage.test.ts` fails if it drifts. Do not
 * add a country here because a source is planned; add it when a predicate
 * returns 'covered' for it.
 */
const COUNTRIES = ['es', 'fr']

/**
 * Which parts of a country we paint.
 *
 * Natural Earth gives France and Spain as MultiPolygons that include the
 * overseas départements and the Atlantic islands. Painting French Guiana and
 * Réunion would be wrong — the app is framed on the Mediterranean and the
 * coastline data behind `isCoastal()` stops well short of them. The Canaries
 * sit inside this box deliberately: SNCZI and SINAC really do cover them, so
 * dropping them would understate Spain.
 *
 * Parts are kept or dropped whole. Clipping vertices to the box would leave a
 * ring cut open along a straight line that reads as a real border.
 */
const BBOX = { west: -19, south: 27, east: 37, north: 52 }

/** Matches `fetch-coastline.mjs` — a vertex every ~10 km. */
const SPACING_KM = 10

const inBox = ([lng, lat]) =>
  lng >= BBOX.west && lng <= BBOX.east && lat >= BBOX.south && lat <= BBOX.north

/** Resamples a closed ring and closes it again, which quantising can undo. */
export function simplifyRing(ring) {
  const points = quantise(resample(ring, SPACING_KM))
  if (points.length < 4) return null
  const [first] = points
  const last = points[points.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) points.push([...first])
  return points
}

export function buildOutlines(geojson) {
  const features = []

  for (const iso of COUNTRIES) {
    const source = geojson.features.find(
      f => (f.properties.ISO_A2_EH ?? f.properties.ISO_A2 ?? '').toLowerCase() === iso,
    )
    if (!source) throw new Error(`Natural Earth has no feature for ${iso}`)

    const parts =
      source.geometry.type === 'Polygon'
        ? [source.geometry.coordinates]
        : source.geometry.coordinates

    const kept = []
    for (const part of parts) {
      // Whole-part test on the outer ring: an overseas département is entirely
      // outside the box, so this never splits a country's mainland.
      if (!part[0].every(inBox)) continue
      const rings = part.map(simplifyRing).filter(Boolean)
      if (rings.length) kept.push(rings)
    }
    if (!kept.length) throw new Error(`No parts of ${iso} fell inside the box`)

    features.push({
      type: 'Feature',
      properties: { iso },
      geometry: { type: 'MultiPolygon', coordinates: kept },
    })
  }

  return { type: 'FeatureCollection', features }
}

function vertexCount(fc) {
  return fc.features.reduce(
    (n, f) => n + f.geometry.coordinates.flat(2).length,
    0,
  )
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url))
  const out = join(here, '..', 'src', 'data', 'country-outlines.generated.json')

  let geojson
  try {
    const res = await fetch(SOURCE)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    geojson = await res.json()
  } catch (e) {
    // Same discipline as the coastline: a stale outline is fine, a truncated
    // one silently shrinks the area we claim to answer in.
    console.error(`Natural Earth fetch failed: ${e.message}`)
    if (existsSync(out)) {
      console.error('Keeping the existing outlines file.')
      process.exit(0)
    }
    process.exit(1)
  }

  const fc = buildOutlines(geojson)
  const previous = existsSync(out) ? vertexCount(JSON.parse(readFileSync(out, 'utf8'))) : 0
  const count = vertexCount(fc)
  if (previous && count < previous * 0.9) {
    console.error(
      `Refusing to write: ${count} vertices vs ${previous} previously. ` +
        'A partial outline paints a smaller country without any error.',
    )
    process.exit(1)
  }

  writeFileSync(
    out,
    JSON.stringify({
      source: 'Natural Earth 50m admin-0 countries (public domain)',
      bbox: BBOX,
      spacingKm: SPACING_KM,
      fetchedAt: new Date().toISOString().slice(0, 10),
      ...fc,
    }),
  )
  console.log(`Wrote ${count} vertices for ${COUNTRIES.join(', ')}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
