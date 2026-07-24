import type { WaterQualityResult } from '../types'
import sinacData from '../data/sinac.json'

interface SinacEntry {
  municipio: string
  ineCode: string
  compliance: WaterQualityResult['compliance']
  sourceType: WaterQualityResult['sourceType']
  year: number
  nitrates_mg_l?: number
  turbidity_ntu?: number
  ecoli?: string
}

const SINAC: Record<string, SinacEntry> = sinacData as Record<string, SinacEntry>

// Static curated seed dataset (13 municipalities) pending the real annual
// SINAC download from datos.gob.es — see AGENT-BRIEF-NEW-DATA-SOURCES.md.
// Lookup is by normalised municipality name, not INE code, since Nominatim
// gives us a name and this codebase has no INE-code source.
function normalise(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export async function getWaterQualityByMunicipality(municipio: string): Promise<WaterQualityResult | null> {
  if (!municipio) return null
  const entry = SINAC[normalise(municipio)]
  if (!entry) return null

  return {
    municipio: entry.municipio,
    compliance: entry.compliance,
    sourceType: entry.sourceType,
    year: entry.year,
    nitrates_mg_l: entry.nitrates_mg_l,
    turbidity_ntu: entry.turbidity_ntu,
    ecoli: entry.ecoli,
    source: 'SINAC',
  }
}
