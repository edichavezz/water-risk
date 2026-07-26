import type { SearchResult, Coordinates, SpainBasin } from '../types'

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
    state?: string
    postcode?: string
  }
}

// Rough basin assignment by province — fine for v1
function inferBasin(provincia: string): SpainBasin {
  const p = provincia.toLowerCase()
  if (['sevilla', 'córdoba', 'jaén', 'granada', 'huelva', 'cádiz'].some(x => p.includes(x))) {
    return 'guadalquivir'
  }
  if (['málaga', 'almería'].some(x => p.includes(x))) return 'sur'
  if (['murcia', 'alicante'].some(x => p.includes(x))) return 'segura'
  if (['badajoz', 'ciudad real'].some(x => p.includes(x))) return 'guadiana'
  return 'other'
}

export async function geocodeAddress(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    countrycodes: 'es',
    limit: '5',
    addressdetails: '1',
  })

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { 'Accept-Language': 'es,en' } }
  )

  if (!res.ok) throw new Error('Geocoding failed')

  const data: NominatimResult[] = await res.json()

  return data.map((r) => {
    const municipio =
      r.address.city ||
      r.address.town ||
      r.address.village ||
      r.address.municipality ||
      ''
    const provincia = r.address.county || r.address.state || ''

    return {
      displayName: r.display_name,
      coordinates: {
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
      },
      municipio,
      provincia,
      basin: inferBasin(provincia),
    }
  })
}

export async function reverseGeocode(coords: Coordinates): Promise<SearchResult | null> {
  const params = new URLSearchParams({
    lat: coords.lat.toString(),
    lon: coords.lng.toString(),
    format: 'json',
    addressdetails: '1',
  })

  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`,
    { headers: { 'Accept-Language': 'es,en' } }
  )

  if (!res.ok) return null

  // Unresolvable coordinates come back as HTTP 200 with `{ error: … }` and no
  // address — open sea and unmapped ground both land here.
  const r: Partial<NominatimResult> = await res.json()
  if (!r.address) return null

  const municipio =
    r.address.city || r.address.town || r.address.village || r.address.municipality || ''
  const provincia = r.address.county || r.address.state || ''

  return {
    displayName: r.display_name ?? '',
    coordinates: coords,
    municipio,
    provincia,
    basin: inferBasin(provincia),
  }
}
