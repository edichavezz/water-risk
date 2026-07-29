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
  updatedAt: string
  source: 'Copernicus EDO'
}

export interface Reservoir {
  codEst: string // REDIAM station code — the key the map features are promoted on
  name: string
  fillPercent: number
  fillPercentAsOf: string
  historicalMeanPercent?: number
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
