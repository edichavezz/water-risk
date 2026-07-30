export * from './workspace'

export type Language = 'en' | 'es'

export interface Coordinates {
  lat: number
  lng: number
}

export type { PlaceContext, BasinRef } from './place'

export interface FloodZoneResult {
  inZone: boolean
  returnPeriod?: '10' | '100' | '500' // years
  source: 'SNCZI'
  note?: string
}

export interface DroughtStatus {
  level: 'none' | 'watch' | 'warning' | 'alert' | 'partial_recovery' | 'recovery' | 'unknown'
  label: string
  /**
   * The date of the slice actually being served, read from the layer's own time
   * dimension. Null when that cannot be determined — never today's date, which
   * would assert a currency the reading may not have.
   */
  updatedAt: string | null
  /** True when the served slice is far older than the publishing cycle. */
  stale: boolean | null
  ageDays: number | null
  source: 'Copernicus EDO'
}

export interface Reservoir {
  codEst: string // REDIAM station code — the key the map features are promoted on
  name: string
  fillPercent: number
  fillPercentAsOf: string
  // Mean fill % on this same calendar date across the last 5 / 10 years.
  // Null where the station has fewer than 3 reporting years — a thin average
  // would read as authoritative "normal" when it is two wet years.
  mean5yr: number | null
  mean10yr: number | null
  distanceKm: number
  basin: string
  systemName?: string
}

export interface WaterQualityResult {
  municipio: string
  compliance: 'compliant' | 'minor_issues' | 'non_compliant' | 'unknown'
  sourceType: 'surface' | 'groundwater' | 'mixed' | 'desalination'
  year: number
  nitrates_mg_l?: number
  turbidity_ntu?: number
  ecoli?: string
  source: 'SINAC'
}

/**
 * Andalucía coastal protection-zone *zoning*, from REDIAM. Not a verdict on
 * whether a property lies inside the legal strip — see coastalZoning.ts.
 */
export interface CoastalZoning {
  /** Management classification of the stretch, e.g. "Áreas Urbanas...". */
  zoning?: string
  /** DPMT sensitivity of the stretch, e.g. "Sensible". */
  sensitivity?: string
  location?: string
  provincia?: string
  /** Nearest surveyed profile and its boundary marker. */
  profile?: string
  marker?: string
  /** Link to the official profile PDF, when it validates as a REDIAM https URL. */
  profileUrl?: string
  source: 'REDIAM'
}

export interface CoastalFloodResult {
  inServidumbre: boolean
  inPolicia: boolean
  source: 'MITERD DPH'
}

export interface GroundwaterResult {
  inOverexploitedUnit: boolean
  unitName?: string
  basin?: string
  source: 'IGME'
}

export type FireDangerClass =
  | 'low'
  | 'moderate'
  | 'high'
  | 'very_high'
  | 'extreme'
  | 'very_extreme'
  | 'unknown'

export interface FireDangerResult {
  danger: FireDangerClass
  /** The day the raster describes, ISO date. */
  forDate: string
  source: 'Copernicus EFFIS'
}

export interface BurntArea {
  /** ISO date of the fire's start, as EFFIS records it. */
  date: string
  areaHa: number
  commune?: string
  province?: string
  /** Straight-line distance from the searched point to the burn, km. */
  distanceKm: number
  /** Share of the burn inside a Natura 2000 site, percent. */
  protectedPercent?: number
}

export interface FireHistoryResult {
  /** Burns within the search radius, most recent first. */
  fires: BurntArea[]
  radiusKm: number
  /** Earliest year the archive covers, so "none found" can be scoped. */
  since: number
  source: 'Copernicus EFFIS'
}

export interface FirePreventionResult {
  /** Region the plan belongs to, in the reader's terms. */
  regionName: string
  planName: string
  url: string
  /** When we last confirmed the link resolved. Government URLs rot. */
  checkedAt: string
  source: string
}

export interface BathingWaterResult {
  siteName: string
  distanceKm: number
  rating: 'excellent' | 'good' | 'sufficient' | 'poor' | 'unknown'
  year: number
  source: 'EEA'
}
