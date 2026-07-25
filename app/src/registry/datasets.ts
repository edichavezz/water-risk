import type { SearchResult } from '../types'
import type { Audience, DatasetId, DatasetResult } from '../types/workspace'
import { getFloodZoneStatus } from '../services/floodZone'
import { getDroughtStatus } from '../services/drought'
import { getReservoirsForLocation } from '../services/reservoirs'
import { getWaterQualityByMunicipality } from '../services/waterQuality'
import { getCoastalFloodStatus, isCoastalProvincia } from '../services/coastalFlood'
import { getGroundwaterStatus } from '../services/groundwater'
import { getNearestBathingSite } from '../services/bathingWater'

export interface DatasetDef {
  id: DatasetId
  category: 'hazard' | 'supply' | 'quality'
  source: { name: string; url?: string }
  mapRole: 'primary' | 'context' | 'none'
  aiAllowed: boolean
  audienceWeight: Record<Audience, number>
  defaultOrder: number
  appliesTo: (location: SearchResult) => boolean
  fetch: (location: SearchResult) => Promise<DatasetResult>
}

function ok<T>(data: T): DatasetResult<T> {
  return { status: 'available', data }
}
function err(e: unknown): DatasetResult {
  return { status: 'error', error: e instanceof Error ? e.message : String(e) }
}

export const DATASETS: DatasetDef[] = [
  {
    id: 'flood',
    category: 'hazard',
    source: { name: 'SNCZI — MITERD', url: 'https://sig.mapama.gob.es/snczi/' },
    mapRole: 'primary',
    aiAllowed: true,
    audienceWeight: { resident_owner: 3, buyer_investor: 1 },
    defaultOrder: 1,
    appliesTo: () => true,
    fetch: async loc => {
      try { return ok(await getFloodZoneStatus(loc.coordinates)) } catch (e) { return err(e) }
    },
  },
  {
    id: 'drought',
    category: 'hazard',
    source: { name: 'Copernicus EDO', url: 'https://edo.jrc.ec.europa.eu/' },
    mapRole: 'primary',
    aiAllowed: true,
    audienceWeight: { resident_owner: 1, buyer_investor: 4 },
    defaultOrder: 2,
    appliesTo: () => true,
    fetch: async loc => {
      try {
        const d = await getDroughtStatus(loc.coordinates)
        return d.level === 'unknown' ? { status: 'unavailable' } : ok(d)
      } catch (e) { return err(e) }
    },
  },
  {
    id: 'reservoirs',
    category: 'supply',
    source: { name: 'REDIAM / MITERD' },
    mapRole: 'context',
    aiAllowed: true,
    audienceWeight: { resident_owner: 2, buyer_investor: 5 },
    defaultOrder: 3,
    appliesTo: () => true,
    fetch: async loc => {
      try {
        const rs = getReservoirsForLocation(loc)
        return rs.length === 0 ? { status: 'unavailable' } : ok(rs)
      } catch (e) { return err(e) }
    },
  },
  {
    id: 'waterQuality',
    category: 'quality',
    source: { name: 'SINAC — Ministerio de Sanidad', url: 'https://sinac.sanidad.gob.es/' },
    mapRole: 'none',
    aiAllowed: true,
    audienceWeight: { resident_owner: 4, buyer_investor: 6 },
    defaultOrder: 4,
    appliesTo: loc => Boolean(loc.municipio),
    fetch: async loc => {
      try {
        const q = await getWaterQualityByMunicipality(loc.municipio ?? '')
        return q === null ? { status: 'unavailable' } : ok(q)
      } catch (e) { return err(e) }
    },
  },
  {
    id: 'coastalFlood',
    category: 'hazard',
    source: { name: 'MITERD Coastal DPH' },
    mapRole: 'primary',
    aiAllowed: true,
    audienceWeight: { resident_owner: 6, buyer_investor: 2 },
    defaultOrder: 5,
    appliesTo: loc => isCoastalProvincia(loc.provincia),
    fetch: async loc => {
      try { return ok(await getCoastalFloodStatus(loc.coordinates)) } catch (e) { return err(e) }
    },
  },
  {
    id: 'groundwater',
    category: 'hazard',
    source: { name: 'IGME' },
    mapRole: 'primary',
    aiAllowed: true,
    audienceWeight: { resident_owner: 5, buyer_investor: 3 },
    defaultOrder: 6,
    appliesTo: () => true,
    fetch: async loc => {
      try { return ok(getGroundwaterStatus(loc.coordinates)) } catch (e) { return err(e) }
    },
  },
  {
    id: 'bathingWater',
    category: 'quality',
    source: { name: 'EEA Bathing Water' },
    mapRole: 'none',
    aiAllowed: true,
    audienceWeight: { resident_owner: 7, buyer_investor: 7 },
    defaultOrder: 7,
    appliesTo: loc => isCoastalProvincia(loc.provincia),
    fetch: async loc => {
      try {
        const s = await getNearestBathingSite(loc.coordinates)
        return s === null ? { status: 'unavailable' } : ok(s)
      } catch (e) { return err(e) }
    },
  },
]

export function getDataset(id: DatasetId): DatasetDef {
  const d = DATASETS.find(x => x.id === id)
  if (!d) throw new Error(`Unknown dataset: ${id}`)
  return d
}

export function orderedDatasets(location: SearchResult, audience: Audience | null): DatasetDef[] {
  return DATASETS
    .filter(d => d.appliesTo(location))
    .sort((a, b) =>
      audience
        ? a.audienceWeight[audience] - b.audienceWeight[audience]
        : a.defaultOrder - b.defaultOrder
    )
}
