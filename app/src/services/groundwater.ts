import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import type { Coordinates, GroundwaterResult } from '../types'
import groundwaterUnits from '../data/groundwater-units.json'

const UNITS = groundwaterUnits as GeoJSON.FeatureCollection<GeoJSON.Polygon>

export function getGroundwaterStatus(coords: Coordinates): GroundwaterResult {
  const pt = point([coords.lng, coords.lat])

  for (const feature of UNITS.features) {
    if (booleanPointInPolygon(pt, feature)) {
      return {
        inOverexploitedUnit: true,
        unitName: feature.properties?.name,
        basin: feature.properties?.basin,
        source: 'IGME',
      }
    }
  }

  return { inOverexploitedUnit: false, source: 'IGME' }
}
