import type maplibregl from 'maplibre-gl'
import { detailedRegionsGeoJSON } from '../services/coverage'

// The western and central Mediterranean. The entry view used to open framed on
// Andalucía, which read as "this is the extent of the app" before the reader
// had typed anything.
export const ENTRY_CENTER: [number, number] = [4.0, 41.5]
export const ENTRY_ZOOM = 4.4
const COVERAGE_GREEN = '#7FA38C'

/**
 * Paints the regions we hold extra local detail for.
 *
 * These are no longer a boundary — the app answers everywhere now — so the
 * legend copy has to carry that, because a filled polygon on a map reads as a
 * limit whatever the label says.
 */
export function addDetailRegionLayers(map: maplibregl.Map): void {
  if (map.getSource('coverage')) return
  map.addSource('coverage', { type: 'geojson', data: detailedRegionsGeoJSON() })
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
