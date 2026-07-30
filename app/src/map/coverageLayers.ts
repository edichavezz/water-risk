import type maplibregl from 'maplibre-gl'
import { detailedRegionsGeoJSON, nationalCoverageGeoJSON } from '../services/coverage'

// The western and central Mediterranean. The entry view used to open framed on
// Andalucía, which read as "this is the extent of the app" before the reader
// had typed anything.
export const ENTRY_CENTER: [number, number] = [4.0, 41.5]
export const ENTRY_ZOOM = 4.4
const COVERAGE_GREEN = '#7FA38C'

/**
 * Paints where the app answers from national registers — Spain and France.
 *
 * This is the layer that says "data available here". It is not a boundary: the
 * app answers everywhere in the Mediterranean, from the continent-wide drought
 * and fire sources. The legend copy has to carry that, because a filled polygon
 * reads as a limit whatever the label says — hence a wash this faint and a
 * dashed edge, so the border reads as soft.
 */
export function addNationalCoverageLayers(map: maplibregl.Map): void {
  if (map.getSource('national-coverage')) return
  map.addSource('national-coverage', { type: 'geojson', data: nationalCoverageGeoJSON() })
  map.addLayer({
    id: 'national-coverage-fill', type: 'fill', source: 'national-coverage',
    paint: { 'fill-color': COVERAGE_GREEN, 'fill-opacity': 0.07 },
  })
  map.addLayer({
    id: 'national-coverage-line', type: 'line', source: 'national-coverage',
    paint: {
      'line-color': COVERAGE_GREEN, 'line-width': 1, 'line-opacity': 0.5,
      'line-dasharray': [3, 2],
    },
  })
}

const COVERAGE_LAYER_IDS = [
  'national-coverage-fill', 'national-coverage-line', 'coverage-line',
]

/**
 * The coverage shading only belongs on the entry view, because `CoverageKey` —
 * the only thing that says what it means — is entry-only too.
 *
 * Leaving them up through a search would put a green wash over two whole
 * countries with nothing to explain it, and an unlabelled filled polygon reads
 * as a limit. The results view has its own legend in `LayerTray`, describing
 * the data layers actually drawn; coverage is not one of them.
 */
export function setCoverageVisible(map: maplibregl.Map, visible: boolean): void {
  for (const id of COVERAGE_LAYER_IDS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
  }
}

export function addDetailRegionLayers(map: maplibregl.Map): void {
  if (map.getSource('coverage')) return
  map.addSource('coverage', { type: 'geojson', data: detailedRegionsGeoJSON() })
  // No fill and no glow any more. Andalucía sits inside Spain, so its own fill
  // stacked on the national wash and rendered the region darker than the rest
  // of the country — reading as "only really here", the exact claim the app
  // stopped making. It gets the same dashed hairline as a national border, one
  // notch fainter, so it reads as a subdivision of the shaded area rather than
  // a highlight on top of it.
  //
  // The "most detail in Andalucía" claim now lives entirely in the copy, which
  // is where this file's own note has always said it belongs: a stronger
  // polygon cannot say "more detail here" without also saying "less use
  // elsewhere".
  map.addLayer({
    id: 'coverage-line', type: 'line', source: 'coverage',
    paint: {
      'line-color': COVERAGE_GREEN, 'line-width': 1, 'line-opacity': 0.35,
      'line-dasharray': [3, 2],
    },
  })
}
