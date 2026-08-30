import type { Coordinates } from '../types'
import type { PlaceContext } from '../types/place'

/**
 * A ranking bias, not a gate. Nominatim ranks results inside this list first,
 * which stops "Cordoba, Argentina" outranking Córdoba — but a place outside it
 * is still findable, because coverage is now a descriptor rather than a filter.
 */
const MED_COUNTRIES = 'es,pt,fr,it,gr,hr,si,mt,cy'

/**
 * Overrides the browser's own Accept-Language so names come back local. Any
 * token that matches no language does this; `local` says what we mean.
 */
const LOCAL_NAMES = 'local'

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

/**
 * Nominatim is asked for local official names — "Sevilla", not "Seville".
 *
 * Deliberate on two counts. It is what the place is actually called, and a
 * reader in Andalucía shown an English exonym nobody there uses is worse off.
 * And it is what everything downstream matches on: the curated supply systems
 * are keyed on Spanish municipality names, so English names silently broke
 * EMASESA's match for Sevilla.
 *
 * Simply omitting the header is not enough — `fetch` sends the browser's own
 * `Accept-Language`, which is how the English names crept in. The
 * `accept-language` *query parameter* overrides the header, and a value that
 * matches no language falls back to the local name, which is exactly what we
 * want. See LOCAL_NAMES.
 */
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

export async function geocodeAddress(query: string): Promise<PlaceContext[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    countrycodes: MED_COUNTRIES,
    limit: '5',
    addressdetails: '1',
    'accept-language': LOCAL_NAMES,
  })

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)

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
    'accept-language': LOCAL_NAMES,
  })

  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`)

  if (!res.ok) return null

  // Unresolvable coordinates come back as HTTP 200 with `{ error: … }` and no
  // address — open sea and unmapped ground both land here.
  const r: Partial<NominatimResult> = await res.json()
  if (!r.address) return null

  return toPlaceContext(r as NominatimResult, coords)
}
