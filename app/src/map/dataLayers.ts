import type maplibregl from 'maplibre-gl'
import maplibre from 'maplibre-gl'
import i18n from '../i18n'
import { useAppStore } from '../store/useAppStore'
import { getSNCZIWmsUrl, SNCZI_LAYERS } from '../services/floodZone'
import { getDroughtWmsUrl } from '../services/drought'
import { getCoastalWmsUrl, COASTAL_LAYERS } from '../services/coastalFlood'
import { getAllReservoirsGeoJSON } from '../services/reservoirs'
import groundwaterUnits from '../data/groundwater-units.json'
import { DATASET_MAP_LAYERS, visibleLayerIds } from './layerPlan'
import { bindLocationPicker } from './pickLocation'
import type { DatasetId } from '../types/workspace'

const WARNING = '#B87535'
const RESERVOIR_MINZOOM = 8

let hoverPopup: maplibregl.Popup | null = null

// Adds every dataset's map sources and layers once, all initially hidden.
export function ensureDataLayers(map: maplibregl.Map): void {
  // ── Flood WMS rasters (worst period drawn on top) ──────────────────────
  const floodDefs = [
    { id: 'flood-t500', layer: SNCZI_LAYERS.T500, opacity: 0.35 },
    { id: 'flood-t100', layer: SNCZI_LAYERS.T100, opacity: 0.40 },
    { id: 'flood-t10', layer: SNCZI_LAYERS.T10, opacity: 0.45 },
  ]
  for (const { id, layer, opacity } of floodDefs) {
    if (map.getSource(`${id}-src`)) continue
    map.addSource(`${id}-src`, { type: 'raster', tiles: [getSNCZIWmsUrl(layer)], tileSize: 256 })
    map.addLayer({ id, type: 'raster', source: `${id}-src`, paint: { 'raster-opacity': opacity }, layout: { visibility: 'none' } })
  }

  // ── Drought WMS raster ─────────────────────────────────────────────────
  if (!map.getSource('drought-src')) {
    map.addSource('drought-src', { type: 'raster', tiles: [getDroughtWmsUrl()], tileSize: 256 })
    map.addLayer({ id: 'drought-layer', type: 'raster', source: 'drought-src', paint: { 'raster-opacity': 0.45 }, layout: { visibility: 'none' } })
  }

  // ── Coastal DPH WMS rasters ────────────────────────────────────────────
  const coastalDefs = [
    { id: 'coastal-servidumbre', layer: COASTAL_LAYERS.servidumbre },
    { id: 'coastal-policia', layer: COASTAL_LAYERS.policia },
  ]
  for (const { id, layer } of coastalDefs) {
    if (map.getSource(`${id}-src`)) continue
    map.addSource(`${id}-src`, { type: 'raster', tiles: [getCoastalWmsUrl(layer)], tileSize: 256 })
    map.addLayer({ id, type: 'raster', source: `${id}-src`, paint: { 'raster-opacity': 0.40 }, layout: { visibility: 'none' } })
  }

  // ── Groundwater overexploited units (vector) ───────────────────────────
  if (!map.getSource('groundwater-src')) {
    map.addSource('groundwater-src', { type: 'geojson', data: groundwaterUnits as GeoJSON.FeatureCollection })
    map.addLayer({ id: 'groundwater-fill', type: 'fill', source: 'groundwater-src', paint: { 'fill-color': WARNING, 'fill-opacity': 0.25 }, layout: { visibility: 'none' } })
    map.addLayer({ id: 'groundwater-line', type: 'line', source: 'groundwater-src', paint: { 'line-color': WARNING, 'line-width': 1.5 }, layout: { visibility: 'none' } })
  }

  // ── Reservoir points (context) — clustered by zoom ─────────────────────
  if (!map.getSource('reservoirs-src')) {
    // promoteId gives every feature a stable id, without which setFeatureState
    // (and so the selected-ring paint expressions below) silently does nothing.
    map.addSource('reservoirs-src', {
      type: 'geojson',
      data: getAllReservoirsGeoJSON(),
      promoteId: 'codEst',
    })
    map.addLayer({
      id: 'reservoirs-halo', type: 'circle', source: 'reservoirs-src', minzoom: RESERVOIR_MINZOOM,
      paint: { 'circle-radius': 11, 'circle-color': '#ffffff', 'circle-opacity': 0.85 },
      layout: { visibility: 'none' },
    })
    map.addLayer({
      id: 'reservoirs-circle', type: 'circle', source: 'reservoirs-src', minzoom: RESERVOIR_MINZOOM,
      paint: {
        'circle-radius': 9,
        'circle-color': ['get', 'colour'],
        'circle-opacity': 0.9,
        'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#204E62', '#ffffff'],
        'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, 1.5],
      },
      layout: { visibility: 'none' },
    })
    map.addLayer({
      id: 'reservoirs-label', type: 'symbol', source: 'reservoirs-src', minzoom: RESERVOIR_MINZOOM,
      layout: {
        'text-field': ['concat', ['to-string', ['get', 'fillPercent']], '%'],
        'text-size': 9, 'text-allow-overlap': true, 'text-ignore-placement': true, visibility: 'none',
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.2)', 'text-halo-width': 0.5 },
    })
    map.addLayer({
      id: 'reservoirs-name', type: 'symbol', source: 'reservoirs-src', minzoom: RESERVOIR_MINZOOM,
      layout: {
        'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 1.6],
        'text-anchor': 'top', 'text-max-width': 10, visibility: 'none',
      },
      paint: { 'text-color': '#20312A', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
    })
  }
}

export function applyLayerPlan(
  map: maplibregl.Map,
  primary: DatasetId | null,
  context: DatasetId[],
): void {
  const visible = visibleLayerIds(primary, context)
  for (const ids of Object.values(DATASET_MAP_LAYERS)) {
    for (const id of ids) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', visible.has(id) ? 'visible' : 'none')
      }
    }
  }
}

let selectedReservoirId: string | number | undefined

export function bindMapInteractions(map: maplibregl.Map): void {
  bindLocationPicker(map)

  map.on('mouseenter', 'reservoirs-circle', e => {
    map.getCanvas().style.cursor = 'pointer'
    const f = e.features?.[0]
    if (!f) return
    const props = f.properties as { name: string; fillPercent: number }
    const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number]
    hoverPopup?.remove()
    hoverPopup = new maplibre.Popup({ closeButton: false, offset: 14, maxWidth: '200px' })
      .setLngLat(coords)
      .setHTML(
        `<div style="font-family:'Atkinson Hyperlegible',sans-serif;padding:2px">` +
        `<div style="font-weight:700;font-size:12px;color:#20312A">${props.name}</div>` +
        `<div style="font-size:16px;font-weight:700;color:#285F77">${props.fillPercent}%</div>` +
        `<div style="font-size:10px;color:#68766F">${i18n.t('map.hoverHint')}</div>` +
        `</div>`,
      )
      .addTo(map)
  })
  map.on('mouseleave', 'reservoirs-circle', () => {
    map.getCanvas().style.cursor = ''
    hoverPopup?.remove()
    hoverPopup = null
  })
  map.on('click', 'reservoirs-circle', e => {
    const f = e.features?.[0]
    if (!f) return
    if (selectedReservoirId !== undefined) {
      map.setFeatureState({ source: 'reservoirs-src', id: selectedReservoirId }, { selected: false })
    }
    selectedReservoirId = f.id
    if (selectedReservoirId !== undefined) {
      map.setFeatureState({ source: 'reservoirs-src', id: selectedReservoirId }, { selected: true })
    }
    useAppStore.getState().selectDataset('reservoirs')
  })
}
