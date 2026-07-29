import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import type { Coordinates } from '../types'
import type { PlaceContext } from '../types/place'
import type { DatasetId } from '../types/workspace'
import { DATASETS } from '../registry/datasets'
import andaluciaBoundary from '../data/andalucia-boundary.json'

/**
 * How much detail a place gets.
 *
 * This used to be a boolean gate: outside Andalucía the app fetched nothing and
 * refused to interpret. That made a descriptive fact about our data ("we hold
 * hand-curated supply systems here") behave like a boundary on the product, and
 * it blocked datasets that are already pan-European — Copernicus drought was
 * refused in France by a polygon, not by any limit of the source.
 */
export type DetailTier = 'detailed' | 'partial' | 'minimal'

export interface CoverageProfile {
  tier: DetailTier
  /** Named region when one applies, for copy like "Andalucía". */
  regionId?: string
  covered: DatasetId[]
  unsupported: DatasetId[]
  coveredCount: number
  totalCount: number
}

interface DetailedRegion {
  id: string
  /** ISO 3166-2 level-4 code, so new regions can join by code, not by polygon. */
  region: string
  effectiveDate: string
  geometry: GeoJSON.Feature<GeoJSON.Polygon>
}

/**
 * Regions we hold extra local detail for — curated supply systems, daily
 * reservoir levels, a drinking-water register. Currently just Andalucía. This
 * is a claim about our data, not a limit on where the app works.
 */
const DETAILED_REGIONS: DetailedRegion[] = [
  {
    id: 'andalucia',
    region: 'ES-AN',
    effectiveDate: '2026-07-24',
    geometry: andaluciaBoundary as GeoJSON.Feature<GeoJSON.Polygon>,
  },
]

function detailedRegionAt(coords: Coordinates): DetailedRegion | undefined {
  const pt = point([coords.lng, coords.lat])
  return DETAILED_REGIONS.find(r => booleanPointInPolygon(pt, r.geometry))
}

/**
 * Derived from the registry rather than from a hand-maintained table of regions
 * and dataset ids, so coverage copy can never claim a check the app does not
 * actually run.
 */
export function coverageProfile(place: PlaceContext): CoverageProfile {
  const covered: DatasetId[] = []
  const unsupported: DatasetId[] = []

  for (const d of DATASETS) {
    const verdict = d.applicability(place)
    if (verdict === 'covered') covered.push(d.id)
    else if (verdict === 'unsupported') unsupported.push(d.id)
  }

  const region = detailedRegionAt(place.coordinates)
  const tier: DetailTier = region ? 'detailed' : covered.length <= 2 ? 'minimal' : 'partial'

  return {
    tier,
    regionId: region?.id,
    covered,
    unsupported,
    coveredCount: covered.length,
    totalCount: DATASETS.length,
  }
}

/**
 * The polygons the map paints. These now mean "extra detail here", not "only
 * here" — the legend copy has to carry that difference, because the shape alone
 * still reads as a boundary.
 */
export function detailedRegionsGeoJSON(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: DETAILED_REGIONS.map(r => r.geometry) }
}
