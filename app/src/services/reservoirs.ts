import type { Coordinates, Reservoir } from '../types'

// Static dataset of major Andalucía reservoirs with coordinates
// Source: MITERD/REDIAM public data
// v1: static seed; v2: replace with live datos.gob.es API
interface ReservoirSeed { name: string; lat: number; lng: number; fillPercent: number; historicalMeanPercent?: number; basin: string }

const ANDALUCIA_RESERVOIRS: ReservoirSeed[] = [
  { name: 'Embalse del Guadalteba', lat: 36.9, lng: -4.85, fillPercent: 45, historicalMeanPercent: 58, basin: 'Sur' },
  { name: 'Embalse del Guadalhorce', lat: 36.95, lng: -4.78, fillPercent: 38, historicalMeanPercent: 52, basin: 'Sur' },
  { name: 'Embalse de La Viñuela', lat: 36.85, lng: -4.2, fillPercent: 22, historicalMeanPercent: 48, basin: 'Sur' },
  { name: 'Embalse de Iznájar', lat: 37.26, lng: -4.31, fillPercent: 55, historicalMeanPercent: 62, basin: 'Guadalquivir' },
  { name: 'Embalse del Tranco', lat: 38.05, lng: -2.81, fillPercent: 68, historicalMeanPercent: 70, basin: 'Guadalquivir' },
  { name: 'Embalse de Béznar', lat: 36.93, lng: -3.59, fillPercent: 31, historicalMeanPercent: 55, basin: 'Sur' },
  { name: 'Embalse de Rules', lat: 36.88, lng: -3.53, fillPercent: 44, historicalMeanPercent: 50, basin: 'Sur' },
  { name: 'Embalse de Colomera', lat: 37.39, lng: -3.73, fillPercent: 29, historicalMeanPercent: 46, basin: 'Guadalquivir' },
  { name: 'Embalse de Canales', lat: 37.18, lng: -3.51, fillPercent: 26, historicalMeanPercent: 44, basin: 'Guadalquivir' },
  { name: 'Embalse de Cubillas', lat: 37.5, lng: -3.73, fillPercent: 33, historicalMeanPercent: 48, basin: 'Guadalquivir' },
  { name: 'Embalse de Bermejales', lat: 37.05, lng: -3.75, fillPercent: 40, historicalMeanPercent: 54, basin: 'Sur' },
  { name: 'Embalse de Negratín', lat: 37.58, lng: -2.97, fillPercent: 52, historicalMeanPercent: 60, basin: 'Guadalquivir' },
  { name: 'Embalse de Beninar', lat: 36.95, lng: -2.65, fillPercent: 18, historicalMeanPercent: 42, basin: 'Sur' },
  { name: 'Embalse del Guadalmellato', lat: 38.02, lng: -4.63, fillPercent: 47, historicalMeanPercent: 55, basin: 'Guadalquivir' },
  { name: 'Embalse del Jándula', lat: 38.08, lng: -4.05, fillPercent: 62, historicalMeanPercent: 65, basin: 'Guadalquivir' },
  { name: 'Embalse de El Pintado', lat: 37.81, lng: -6.0, fillPercent: 38, historicalMeanPercent: 52, basin: 'Guadalquivir' },
  { name: 'Embalse de La Minilla', lat: 37.83, lng: -5.8, fillPercent: 42, historicalMeanPercent: 56, basin: 'Guadalquivir' },
]

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
    features: ANDALUCIA_RESERVOIRS.map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        name: r.name,
        fillPercent: r.fillPercent,
        historicalMeanPercent: r.historicalMeanPercent ?? null,
        basin: r.basin,
        colour: fillColour(r.fillPercent),
      },
    })),
  }
}

export function getNearbyReservoirs(coords: Coordinates, radiusKm = 80, limit = 3): Reservoir[] {
  return ANDALUCIA_RESERVOIRS.map((r) => ({
    name: r.name,
    fillPercent: r.fillPercent,
    historicalMeanPercent: r.historicalMeanPercent,
    basin: r.basin,
    distanceKm: Math.round(haversineKm(coords, r)),
  }))
    .filter((r) => r.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
}

// TODO v2: Replace with live datos.gob.es API call
// https://datos.gob.es/es/catalogo/ea0043519-sistema-automatico-de-informacion-hidrologica-saih-de-la-demarcacion-hidrografica-del-guadalquivir
// and REDIAM Andalusia Reservoir Viewer data feed
