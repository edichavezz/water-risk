import type { Coordinates, BathingWaterResult } from '../types'

// NOTE (verified 2026-07): the brief's suggested endpoint
// (bathing-water-quality.eea.europa.eu) does not resolve — no such host.
// This is EEA's real, live ArcGIS REST service backing the Bathing Water
// viewer, confirmed with a live test query returning 2,268 Spanish sites.
const EEA_BATHING_WATER_API =
  'https://water.discomap.eea.europa.eu/arcgis/rest/services/BathingWater/BathingWater_Dyna_WM/MapServer/0/query'

// EEA's live ArcGIS layer exposes qualityStatus as a static column — its
// field alias is literally "2022", confirmed via live metadata inspection
// (MapServer/0?f=json). This is NOT a rolling "current year minus one"
// value despite the service being named "_Dyna_WM" — it's a snapshot.
const CURRENT_SEASON_YEAR = 2022

interface RawSite {
  bathingWaterName: string
  countryCode: string
  bwWaterCategory: string
  longitude: number
  latitude: number
  qualityStatus: string
  bathingWaterIdentifier: string
}

let cachedSites: RawSite[] | null = null

async function fetchAllSites(): Promise<RawSite[]> {
  if (cachedSites) return cachedSites

  const params = new URLSearchParams({
    where: "countryCode='ES'",
    outFields: 'bathingWaterName,countryCode,bwWaterCategory,longitude,latitude,qualityStatus,bathingWaterIdentifier',
    returnGeometry: 'false',
    f: 'json',
  })

  const res = await fetch(`${EEA_BATHING_WATER_API}?${params}`)
  if (!res.ok) throw new Error('EEA bathing water API failed')
  const data = await res.json()
  const features: { attributes: RawSite }[] = data.features ?? []
  cachedSites = features.map(f => f.attributes)
  return cachedSites
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

function normaliseRating(status: string): BathingWaterResult['rating'] {
  switch (status) {
    case 'Excellent': return 'excellent'
    case 'Good': return 'good'
    case 'Sufficient': return 'sufficient'
    case 'Poor': return 'poor'
    default: return 'unknown'
  }
}

export async function getNearestBathingSite(coords: Coordinates): Promise<BathingWaterResult | null> {
  const sites = await fetchAllSites()

  let nearest: { site: RawSite; distanceKm: number } | null = null
  for (const site of sites) {
    if (typeof site.latitude !== 'number' || typeof site.longitude !== 'number') continue
    const distanceKm = haversineKm(coords, { lat: site.latitude, lng: site.longitude })
    if (!nearest || distanceKm < nearest.distanceKm) nearest = { site, distanceKm }
  }

  if (!nearest || nearest.distanceKm > 5) return null

  return {
    siteName: nearest.site.bathingWaterName,
    distanceKm: Math.round(nearest.distanceKm * 10) / 10,
    rating: normaliseRating(nearest.site.qualityStatus),
    year: CURRENT_SEASON_YEAR,
    source: 'EEA',
  }
}
