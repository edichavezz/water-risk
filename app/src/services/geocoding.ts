import i18n from '../i18n'
import type { Coordinates } from '../types'
import type { PlaceContext } from '../types/place'

/**
 * A ranking bias, not a gate. Nominatim ranks results inside this list first,
 * which stops "Cordoba, Argentina" outranking Córdoba — but a place outside it
 * is still findable, because coverage is now a descriptor rather than a filter.
 */
const MED_COUNTRIES = 'es,pt,fr,it,gr,hr,si,mt,cy'

interface NominatimAddress {
  city?: string
  town?: string
  village?: string
  municipality?: string
  county?: string
  province?: string
  state?: string
  postcode?: string
  country_code?: string
  'ISO3166-2-lvl4'?: string
  'ISO3166-2-lvl6'?: string
}

interface NominatimResult {
  place_id: number
  osm_type?: string
  osm_id?: number
  display_name: string
  lat: string
  lon: string
  address: NominatimAddress
}

function toPlaceContext(r: NominatimResult, coords?: Coordinates): PlaceContext {
  const a = r.address

  // `province` first, then `county`. Nominatim returns `province: "Sevilla"`
  // with no `county` for Andalusian cities, so reading `county ?? state` gave
  // "Andalucía" as the province — which then failed every province-level test
  // downstream. Verified against live responses for ES, FR and IT.
  const provinceName = a.province || a.county || a.state || ''

  return {
    displayName: r.display_name ?? '',
    coordinates: coords ?? { lat: parseFloat(r.lat), lng: parseFloat(r.lon) },
    countryCode: a.country_code?.toLowerCase(),
    region: a['ISO3166-2-lvl4'],
    province: a['ISO3166-2-lvl6'],
    provinceName,
    municipality: a.city || a.town || a.village || a.municipality || '',
    postcode: a.postcode,
    osmId: r.osm_type && r.osm_id ? `${r.osm_type}/${r.osm_id}` : undefined,
  }
}

// Nominatim ranks by the reader's own language, so a Spanish speaker searching
// in Italy still gets names they can read.
function acceptLanguage(): string {
  return `${i18n.language || 'en'},en`
}

export async function geocodeAddress(query: string): Promise<PlaceContext[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    countrycodes: MED_COUNTRIES,
    limit: '5',
    addressdetails: '1',
  })

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'Accept-Language': acceptLanguage() },
  })

  if (!res.ok) throw new Error('Geocoding failed')

  const data: NominatimResult[] = await res.json()
  return data.map(r => toPlaceContext(r))
}

export async function reverseGeocode(coords: Coordinates): Promise<PlaceContext | null> {
  const params = new URLSearchParams({
    lat: coords.lat.toString(),
    lon: coords.lng.toString(),
    format: 'json',
    addressdetails: '1',
  })

  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { 'Accept-Language': acceptLanguage() },
  })

  if (!res.ok) return null

  // Unresolvable coordinates come back as HTTP 200 with `{ error: … }` and no
  // address — open sea and unmapped ground both land here.
  const r: Partial<NominatimResult> = await res.json()
  if (!r.address) return null

  return toPlaceContext(r as NominatimResult, coords)
}
