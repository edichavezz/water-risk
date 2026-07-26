import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import type { Coordinates } from '../types'
import type { DatasetId } from '../types/workspace'
import { ALL_DATASET_IDS } from '../types/workspace'
import andaluciaBoundary from '../data/andalucia-boundary.json'

export interface CoverageRegion {
  id: string
  status: 'available'
  datasets: DatasetId[]
  effectiveDate: string
  geometry: GeoJSON.Feature<GeoJSON.Polygon>
}

export interface CoverageResult {
  supported: boolean
  regionId?: string
  datasets: DatasetId[]
}

const REGIONS: CoverageRegion[] = [
  {
    id: 'andalucia',
    status: 'available',
    datasets: ALL_DATASET_IDS,
    effectiveDate: '2026-07-24',
    geometry: andaluciaBoundary as GeoJSON.Feature<GeoJSON.Polygon>,
  },
]

export function lookupCoverage(coords: Coordinates): CoverageResult {
  const pt = point([coords.lng, coords.lat])
  for (const region of REGIONS) {
    if (booleanPointInPolygon(pt, region.geometry)) {
      return { supported: true, regionId: region.id, datasets: region.datasets }
    }
  }
  return { supported: false, datasets: [] }
}

export function getCoverageGeoJSON(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: REGIONS.map(r => r.geometry) }
}
