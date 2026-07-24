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

export function shapeReservoir(station, today) {
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
  }
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

  const reservoirs = stations
    .map(s => shapeReservoir(s, today))
    .filter(Boolean)

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
