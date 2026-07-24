export type UserType = 'buyer' | 'renter' | 'farmer' | 'business'
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
  name: string
  fillPercent: number
  historicalMeanPercent?: number
  distanceKm: number
  basin: string
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

export interface BathingWaterResult {
  siteName: string
  distanceKm: number
  rating: 'excellent' | 'good' | 'sufficient' | 'poor' | 'unknown'
  year: number
  source: 'EEA'
}

export interface RiskProfile {
  location: SearchResult
  floodZone: FloodZoneResult | null
  drought: DroughtStatus | null
  reservoirs: Reservoir[]
  bathingWater: BathingWaterResult | null
  aiSummary?: string
  aiQuestions?: string[]
  loading: boolean
  error?: string
}
