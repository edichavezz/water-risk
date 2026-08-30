import type { Coordinates } from './index'

/**
 * A river basin district, keyed by its EU Water Framework Directive code
 * (ES050, FR000D, ITC…). Resolved from a polygon lookup rather than inferred
 * from a province name, so it works outside Spain.
 */
export interface BasinRef {
  id: string
  name: string
}

/**
 * Everything the dataset registry is allowed to reason about geographically.
 *
 * The ISO 3166-2 codes are what make this work across countries: names are
 * ambiguous (Spain alone has ~200 duplicate municipality names) and localised,
 * while `ES-SE` / `FR-13` / `IT-PA` are stable join keys. Nominatim returns
 * both levels for ES, FR and IT.
 */
export interface PlaceContext {
  displayName: string
  coordinates: Coordinates

  /** ISO 3166-1 alpha-2, lowercase — from Nominatim `address.country_code`. */
  countryCode?: string
  /** ISO 3166-2 level 4: ES-AN, FR-PAC, IT-82. */
  region?: string
  /** ISO 3166-2 level 6: ES-SE, FR-13, IT-PA. */
  province?: string
  /** Human-readable province / département / provincia. Display only. */
  provinceName?: string
  municipality?: string
  postcode?: string

  /** `${osm_type}/${osm_id}` — the only stable identifier Nominatim gives us. */
  osmId?: string

  basin?: BasinRef
}
