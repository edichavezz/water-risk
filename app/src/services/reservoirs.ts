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
const FETCHED_AT = generated.fetchedAt as string

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
    name: titleCase(r.name),
    fillPercent: r.fillPercent,
    fillPercentAsOf: FETCHED_AT,
    basin: r.basin,
    distanceKm: Math.round(haversineKm(coords, r)),
    systemName,
  }
}

function titleCase(s: string): string {
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

// GeoJSON for all reservoirs — used by MapView to render the layer
export function getAllReservoirsGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: RESERVOIRS.map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        name: titleCase(r.name),
        fillPercent: r.fillPercent,
        historicalMeanPercent: null, // REDIAM's feed has no historical-mean field; kept for MapView.tsx's existing property shape
        basin: r.basin,
        colour: fillColour(r.fillPercent),
      },
    })),
  }
}

/**
 * First tries to match the location's municipality against a known supply
 * system (returns every reservoir feeding that system). Falls back to
 * nearest-3-within-80km when no system match is found — most Andalucía
 * municipalities aren't in the researched supply-system lists yet.
 */
export function getReservoirsForLocation(location: SearchResult): Reservoir[] {
  const coords = location.coordinates
  const municipio = location.municipio ? normalizeMunicipio(location.municipio) : ''

  if (municipio) {
    const matchedSystems = SUPPLY_SYSTEMS.filter(s => s.servesMunicipalities.includes(municipio))
    if (matchedSystems.length > 0) {
      const codEstToSystemName = new Map<string, string>()
      for (const s of matchedSystems) {
        for (const codEst of s.reservoirCodEsts) codEstToSystemName.set(codEst, s.name)
      }
      return RESERVOIRS
        .filter(r => codEstToSystemName.has(r.codEst))
        .map(r => toReservoir(r, coords, codEstToSystemName.get(r.codEst)))
        .sort((a, b) => a.distanceKm - b.distanceKm)
    }
  }

  return getNearbyReservoirs(coords)
}

export function getNearbyReservoirs(coords: Coordinates, radiusKm = 80, limit = 3): Reservoir[] {
  return RESERVOIRS.map(r => toReservoir(r, coords))
    .filter(r => r.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
}
