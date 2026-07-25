import type maplibregl from 'maplibre-gl'
import { getCoverageGeoJSON } from '../services/coverage'

export const ENTRY_CENTER: [number, number] = [-4.6, 37.4]
export const ENTRY_ZOOM = 6.3
const COVERAGE_GREEN = '#7FA38C'

export function addCoverageLayers(map: maplibregl.Map): void {
  if (map.getSource('coverage')) return
  map.addSource('coverage', { type: 'geojson', data: getCoverageGeoJSON() })
  map.addLayer({
    id: 'coverage-fill', type: 'fill', source: 'coverage',
    paint: { 'fill-color': COVERAGE_GREEN, 'fill-opacity': 0.15 },
  })
  map.addLayer({
    id: 'coverage-glow', type: 'line', source: 'coverage',
    paint: { 'line-color': COVERAGE_GREEN, 'line-width': 8, 'line-blur': 6, 'line-opacity': 0.35 },
  })
  map.addLayer({
    id: 'coverage-line', type: 'line', source: 'coverage',
    paint: { 'line-color': COVERAGE_GREEN, 'line-width': 1.5, 'line-opacity': 0.8 },
  })
}
