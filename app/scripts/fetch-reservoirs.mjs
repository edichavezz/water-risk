#!/usr/bin/env node
import { writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import proj4 from 'proj4'

proj4.defs('EPSG:25830', '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs')

const STATIONS_URL = 'https://portalrediam.cica.es/embalses/api/json/embalses'
const TODAY_URL = 'https://portalrediam.cica.es/embalses/api/json/andalucia'
const OUTPUT_PATH = fileURLToPath(new URL('../src/data/reservoirs.generated.json', import.meta.url))

export function parseGeom(geom) {
  const match = geom.match(/POINT \(([-\d.]+) ([-\d.]+)\)/)
  if (!match) throw new Error(`Unparseable geom: ${geom}`)
  const x = parseFloat(match[1])
  const y = parseFloat(match[2])
  const [lng, lat] = proj4('EPSG:25830', 'EPSG:4326', [x, y])
  return { lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 }
}

// A station needs at least this many reporting years before an average is
// worth showing — two wet years would otherwise masquerade as "normal".
const MIN_YEARS = 3

function meanOf(values) {
  if (values.length < MIN_YEARS) return null
  const sum = values.reduce((a, b) => a + b, 0)
  return Math.round((sum / values.length) * 10) / 10
}

/**
 * Mean fill % for one station across the same calendar date in past years.
 * `history` is ordered most-recent-first, so the 5-year window is a prefix of
 * the 10-year one. Years where the station reported nothing (built later, or
 * out of service) are skipped rather than counted as zero.
 */
export function historicalMeans(codEst, history) {
  const valueAt = i => {
    const v = history[i]?.[`${codEst}_por`]
    return typeof v === 'number' ? v : null
  }
  const window = n =>
    Array.from({ length: n }, (_, i) => valueAt(i)).filter(v => v !== null)

  return {
    mean5yr: meanOf(window(5)),
    mean10yr: meanOf(window(10)),
  }
}

export function shapeReservoir(station, today, history = []) {
  const codEst = station.cod_est
  const fillPercent = today[`${codEst}_por`]
  if (fillPercent == null) return null
  const { lat, lng } = parseGeom(station.geom)
  return {
    codEst,
    name: station.nombre.trim(),
    province: station.provincia.trim(),
    river: station.nombre_rio.trim(),
    system: station.sistema.trim(),
    basin: station.dist_dem.trim(),
    lat,
    lng,
    fillPercent,
    storedHm3: today[`${codEst}_res`],
    capacityHm3: today[`${codEst}_cap`],
    ...historicalMeans(codEst, history),
  }
}

const HISTORY_YEARS = 10

// REDIAM is date-indexed on the same endpoint as today's bulletin. Requests are
// sequential with a small gap: this is a build-time script hitting a public
// service, and ten polite requests cost a few seconds once a day.
async function fetchHistory(fecha) {
  const [y, m, d] = fecha.split('-').map(Number)
  const days = []
  for (let back = 1; back <= HISTORY_YEARS; back++) {
    const past = `${y - back}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    try {
      const res = await fetch(`${TODAY_URL}/${past}`)
      if (!res.ok) {
        console.warn(`No bulletin for ${past} (HTTP ${res.status}) — skipping that year.`)
        days.push({})
      } else {
        days.push(await res.json())
      }
    } catch (err) {
      console.warn(`History fetch failed for ${past} (${err.message}) — skipping that year.`)
      days.push({})
    }
    await new Promise(r => setTimeout(r, 250))
  }
  return days
}

async function main() {
  let stations, today
  try {
    const [stationsRes, todayRes] = await Promise.all([fetch(STATIONS_URL), fetch(TODAY_URL)])
    if (!stationsRes.ok || !todayRes.ok) {
      throw new Error(`REDIAM responded stations=${stationsRes.status} today=${todayRes.status}`)
    }
    stations = await stationsRes.json()
    today = await todayRes.json()
  } catch (err) {
    if (existsSync(OUTPUT_PATH)) {
      console.warn(`REDIAM fetch failed (${err.message}). Keeping existing reservoirs.generated.json unchanged.`)
      process.exit(0)
    }
    throw err
  }

  // History is best-effort: a failure here must never cost us today's levels.
  const history = await fetchHistory(today.fecha)

  const reservoirs = stations
    .map(s => shapeReservoir(s, today, history))
    .filter(Boolean)

  const withHistory = reservoirs.filter(r => r.mean10yr !== null).length
  console.log(`${withHistory}/${reservoirs.length} reservoirs have a 10-year average.`)

  const skipped = stations.length - reservoirs.length
  if (skipped > 0) {
    console.warn(`${skipped} station(s) had no fill reading for ${today.fecha} and were skipped.`)
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify({ fetchedAt: today.fecha, reservoirs }, null, 2) + '\n')
  console.log(`Wrote ${reservoirs.length} reservoirs (data as of ${today.fecha}) to ${OUTPUT_PATH}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
