import type { Coordinates, Reservoir, SearchResult } from '../types'
import { SUPPLY_SYSTEMS } from '../data/supplySystems'
import generated from '../data/reservoirs.generated.json'

interface GeneratedReservoir {
  codEst: string
  name: string
  province: string
  river: string
  system: string
  basin: string
  lat: number
  lng: number
  fillPercent: number
  storedHm3: number
  capacityHm3: number
}

const RESERVOIRS = generated.reservoirs as GeneratedReservoir[]
// REDIAM's own bulletin date (`fecha`) for the readings — the date the levels
// were measured, not the date our pipeline ran.
const FETCHED_AT = generated.fetchedAt as string

export function reservoirsAsOf(): string {
  return FETCHED_AT
}

function haversineKm(a: Coordinates, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const x =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng * sinDLng
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export function normalizeMunicipio(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function toReservoir(r: GeneratedReservoir, coords: Coordinates, systemName?: string): Reservoir {
  return {
    codEst: r.codEst,
    name: titleCase(r.name),
    fillPercent: r.fillPercent,
    fillPercentAsOf: FETCHED_AT,
    basin: r.basin,
    distanceKm: Math.round(haversineKm(coords, r)),
    systemName,
  }
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i === 0 || w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

// Fill % → colour used by both the map circles and the panel bars
export function fillColour(pct: number): string {
  if (pct < 25) return '#ef4444'  // red
  if (pct < 40) return '#f97316'  // orange
  if (pct < 60) return '#eab308'  // yellow
  return '#3b82f6'                // blue
}

export function allReservoirCodEsts(): string[] {
  return RESERVOIRS.map(r => r.codEst)
}

export function reservoirLngLat(codEst: string): [number, number] | null {
  const r = RESERVOIRS.find(x => x.codEst === codEst)
  return r ? [r.lng, r.lat] : null
}

// GeoJSON for all reservoirs — used by MapView to render the layer
export function getAllReservoirsGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: RESERVOIRS.map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        codEst: r.codEst,
        name: titleCase(r.name),
        fillPercent: r.fillPercent,
        storedHm3: r.storedHm3,
        capacityHm3: r.capacityHm3,
        historicalMeanPercent: null, // REDIAM's feed has no historical-mean field; kept for MapView.tsx's existing property shape
        basin: r.basin,
        river: r.river,
        province: r.province,
        asOf: FETCHED_AT,
        colour: fillColour(r.fillPercent),
      },
    })),
  }
}

/**
 * Every reservoir feeding the supply system that serves this municipality.
 *
 * Returns nothing when the municipality isn't in SUPPLY_SYSTEMS. There is no
 * proximity fallback: a reservoir 10 km away may be pure irrigation storage
 * and supply nobody, so "nearest" answers a question the user didn't ask and
 * reads as an answer to the one they did. An empty result is the honest state,
 * and SUPPLY_SYSTEMS covers ~133 of Andalucía's ~785 municipalities today.
 */
export function getReservoirsForLocation(location: SearchResult): Reservoir[] {
  const coords = location.coordinates
  const municipio = location.municipality ? normalizeMunicipio(location.municipality) : ''

  if (!municipio) return []

  const matchedSystems = SUPPLY_SYSTEMS.filter(s => s.servesMunicipalities.includes(municipio))
  if (matchedSystems.length === 0) return []

  const codEstToSystemName = new Map<string, string>()
  for (const s of matchedSystems) {
    for (const codEst of s.reservoirCodEsts) codEstToSystemName.set(codEst, s.name)
  }
  return RESERVOIRS
    .filter(r => codEstToSystemName.has(r.codEst))
    .map(r => toReservoir(r, coords, codEstToSystemName.get(r.codEst)))
    .sort((a, b) => a.distanceKm - b.distanceKm)
}
