export * from './workspace'

export type Language = 'en' | 'es'

export interface Coordinates {
  lat: number
  lng: number
}

export interface SearchResult {
  displayName: string
  coordinates: Coordinates
  municipio?: string
  provincia?: string
  basin?: SpainBasin
}

export type SpainBasin =
  | 'guadalquivir'
  | 'sur'
  | 'segura'
  | 'guadiana'
  | 'tajo'
  | 'duero'
  | 'ebro'
  | 'jucar'
  | 'other'

export interface FloodZoneResult {
  inZone: boolean
  returnPeriod?: '10' | '100' | '500' // years
  source: 'SNCZI'
  note?: string
}

export interface DroughtStatus {
  level: 'none' | 'watch' | 'warning' | 'alert' | 'partial_recovery' | 'recovery' | 'unknown'
  label: string
  updatedAt: string
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

export interface BathingWaterResult {
  siteName: string
  distanceKm: number
  rating: 'excellent' | 'good' | 'sufficient' | 'poor' | 'unknown'
  year: number
  source: 'EEA'
}
