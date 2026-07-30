import type maplibregl from 'maplibre-gl'
import type { ExpressionSpecification } from 'maplibre-gl'
import maplibre from 'maplibre-gl'
import i18n from '../i18n'
import { formatLongDate } from '../i18n/formatDate'
import { useAppStore } from '../store/useAppStore'
import { getSNCZIWmsUrl, SNCZI_LAYERS } from '../services/floodZone'
import { getDroughtWmsUrl } from '../services/drought'
import { getFireDangerWmsUrl } from '../services/fireDanger'
import { fireHistoryQueryUrl } from '../services/fireHistory'
import { getCoastalWmsUrl, COASTAL_MAP_LAYERS } from '../services/coastalFlood'
import { allReservoirCodEsts, getAllReservoirsGeoJSON, titleCase } from '../services/reservoirs'
import groundwaterUnits from '../data/groundwater-units.json'
import { DATASET_MAP_LAYERS, visibleLayerIds } from './layerPlan'

/* Burn scars: the fire accent darkened, so an outline still reads over a
   translucent primary raster. */
const FIRE_SCAR = '#8A3E1E'
import { bindLocationPicker } from './pickLocation'
import type { DatasetId } from '../types/workspace'

const WARNING = '#B87535'
// Markers appear at the entry view's zoom (6.3) so toggling the reservoirs
// layer there visibly does something; the per-marker text only joins once
// there is room for it, otherwise 72 labels collide at national scale.
const RESERVOIR_MINZOOM = 6
const RESERVOIR_LABEL_MINZOOM = 8

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

  // ── Fire danger WMS raster ─────────────────────────────────────────────
  // Lower opacity than drought: this is a continental forecast grid and at
  // 0.45 its blocky ~8 km cells swamp the basemap's place names.
  if (!map.getSource('fire-danger-src')) {
    map.addSource('fire-danger-src', {
      type: 'raster',
      tiles: [getFireDangerWmsUrl()],
      tileSize: 256,
    })
    map.addLayer({
      id: 'fire-danger-layer',
      type: 'raster',
      source: 'fire-danger-src',
      paint: { 'raster-opacity': 0.35 },
      layout: { visibility: 'none' },
    })
  }

  // ── Past fire perimeters ───────────────────────────────────────────────
  // A context overlay, and deliberately outline-led: burn scars are irregular
  // and a filled choropleth of them fights whatever primary layer is active.
  if (!map.getSource('fire-history-src')) {
    map.addSource('fire-history-src', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
    map.addLayer({
      id: 'fire-history-fill',
      type: 'fill',
      source: 'fire-history-src',
      paint: { 'fill-color': FIRE_SCAR, 'fill-opacity': 0.18 },
      layout: { visibility: 'none' },
    })
    map.addLayer({
      id: 'fire-history-line',
      type: 'line',
      source: 'fire-history-src',
      paint: { 'line-color': FIRE_SCAR, 'line-width': 1.5, 'line-opacity': 0.9 },
      layout: { visibility: 'none' },
    })
  }

  // ── Coastal DPH WMS rasters ────────────────────────────────────────────
  const coastalDefs = [
    { id: 'coastal-tramos', layer: COASTAL_MAP_LAYERS.tramos },
    { id: 'coastal-zsp', layer: COASTAL_MAP_LAYERS.zsp },
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
    // `highlighted` is true for any reservoir in the current result set. When a
    // result set exists, everything outside it is dimmed back so the ones that
    // matter read first; `selected` (clicked) always wins the ring.
    const isSelected: ExpressionSpecification = ['boolean', ['feature-state', 'selected'], false]
    const isHighlighted: ExpressionSpecification = ['boolean', ['feature-state', 'highlighted'], false]
    const isDimmed: ExpressionSpecification = ['boolean', ['feature-state', 'dimmed'], false]

    // Markers are drawn small enough to read as dots at national scale and
    // grow to their full size by the zoom a search lands on. At a flat radius
    // the 72 markers would be white blobs across the whole country on first
    // load, since the reservoirs layer is on by default.
    // MapLibre allows exactly one zoom-based subexpression per paint property.
    // Wrapping a `case` around several zoom interpolations broke that rule, so
    // every one of these layers was rejected at addLayer and the reservoir
    // markers silently never drew — and because the throw escaped
    // ensureDataLayers, nothing registered after them either.
    //
    // The fix is to invert the nesting: interpolate on zoom once at the top,
    // and pick the state-dependent value inside each stop.
    const byState = (
      selected: number,
      highlighted: number,
      base: number,
    ): ExpressionSpecification => ['case', isSelected, selected, isHighlighted, highlighted, base]

    const zoomStates = (
      wide: [number, number, number],
      close: [number, number, number],
    ): ExpressionSpecification => [
      'interpolate', ['linear'], ['zoom'],
      RESERVOIR_MINZOOM, byState(...wide),
      RESERVOIR_LABEL_MINZOOM, byState(...close),
    ]

    map.addLayer({
      id: 'reservoirs-halo', type: 'circle', source: 'reservoirs-src', minzoom: RESERVOIR_MINZOOM,
      paint: {
        'circle-radius': zoomStates([6, 6, 4.5], [14, 14, 11]),
        'circle-color': '#ffffff',
        'circle-opacity': ['case', ['boolean', ['feature-state', 'dimmed'], false], 0.35, 0.85],
      },
      layout: { visibility: 'none' },
    })
    map.addLayer({
      id: 'reservoirs-circle', type: 'circle', source: 'reservoirs-src', minzoom: RESERVOIR_MINZOOM,
      paint: {
        'circle-radius': zoomStates([5, 5, 3.5], [11, 11, 9]),
        'circle-color': ['get', 'colour'],
        'circle-opacity': [
          'case',
          isSelected, 1,
          isHighlighted, 1,
          isDimmed, 0.35,
          0.9,
        ],
        'circle-stroke-color': [
          'case',
          isSelected, '#204E62',
          isHighlighted, '#204E62',
          '#ffffff',
        ],
        'circle-stroke-width': zoomStates([1.5, 1.25, 0.75], [3, 2.5, 1.5]),
      },
      layout: { visibility: 'none' },
    })
    map.addLayer({
      id: 'reservoirs-label', type: 'symbol', source: 'reservoirs-src', minzoom: RESERVOIR_LABEL_MINZOOM,
      layout: {
        'text-field': ['concat', ['to-string', ['get', 'fillPercent']], '%'],
        'text-size': 9, 'text-allow-overlap': true, 'text-ignore-placement': true, visibility: 'none',
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.2)', 'text-halo-width': 0.5 },
    })
    map.addLayer({
      id: 'reservoirs-name', type: 'symbol', source: 'reservoirs-src', minzoom: RESERVOIR_LABEL_MINZOOM,
      layout: {
        'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 1.6],
        'text-anchor': 'top', 'text-max-width': 10, visibility: 'none',
      },
      paint: {
        'text-color': '#20312A',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
        'text-opacity': ['case', ['boolean', ['feature-state', 'dimmed'], false], 0.4, 1],
      },
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
let detailPopup: maplibregl.Popup | null = null

// Every codEst currently carrying a feature-state, so it can be cleared
// explicitly — setFeatureState merges, it never replaces.
let highlightedCodEsts: string[] = []
let dimmedCodEsts: string[] = []

/**
 * Marks the reservoirs behind the current result set and dims the rest, so the
 * ones the panel is talking about are findable on the map. Pass an empty list
 * to return every marker to its neutral state.
 */
export function applyReservoirHighlight(map: maplibregl.Map, codEsts: string[]): void {
  if (!map.getSource('reservoirs-src')) return

  for (const id of highlightedCodEsts) {
    map.setFeatureState({ source: 'reservoirs-src', id }, { highlighted: false })
  }
  for (const id of dimmedCodEsts) {
    map.setFeatureState({ source: 'reservoirs-src', id }, { dimmed: false })
  }
  highlightedCodEsts = []
  dimmedCodEsts = []
  if (codEsts.length === 0) return

  const highlighted = new Set(codEsts)
  for (const id of codEsts) {
    map.setFeatureState({ source: 'reservoirs-src', id }, { highlighted: true })
  }
  highlightedCodEsts = [...codEsts]

  // Dimming is what makes the highlight read as a set rather than as decoration.
  for (const feature of allReservoirCodEsts()) {
    if (highlighted.has(feature)) continue
    map.setFeatureState({ source: 'reservoirs-src', id: feature }, { dimmed: true })
    dimmedCodEsts.push(feature)
  }
}

export interface ReservoirProps {
  name: string
  fillPercent: number
  storedHm3: number | null
  capacityHm3: number | null
  basin: string
  river: string
  province: string
  asOf: string
}

// The click popup — the "detail" the hover hint promises. Built as DOM rather
// than HTML so upstream names are never interpolated into markup.
export function reservoirDetailContent(props: ReservoirProps): HTMLElement {
  const el = document.createElement('div')
  el.className = 'reservoir-popup'

  const name = document.createElement('div')
  name.className = 'reservoir-popup__name'
  name.textContent = props.name
  el.append(name)

  const pct = document.createElement('div')
  pct.className = 'reservoir-popup__pct'
  pct.textContent = `${props.fillPercent}%`
  el.append(pct)

  const lines: string[] = []
  if (props.storedHm3 != null && props.capacityHm3 != null) {
    lines.push(i18n.t('map.reservoir.storage', {
      stored: props.storedHm3.toLocaleString(i18n.language, { maximumFractionDigits: 1 }),
      capacity: props.capacityHm3.toLocaleString(i18n.language, { maximumFractionDigits: 1 }),
    }))
  }
  if (props.river) lines.push(titleCase(props.river))
  if (props.basin) {
    lines.push(i18n.t('map.reservoir.basin', { basin: titleCase(props.basin) }))
  }
  for (const text of lines) {
    const row = document.createElement('div')
    row.className = 'reservoir-popup__row'
    row.textContent = text
    el.append(row)
  }

  const asOf = document.createElement('div')
  asOf.className = 'reservoir-popup__asof'
  asOf.textContent = i18n.t('map.reservoir.asOf', { date: formatLongDate(props.asOf) })
  el.append(asOf)

  return el
}

// Keeps the fit clear of the workspace panel (left, on md+) and the mobile
// bottom sheet, so a "fitted" marker never lands underneath a panel.
export function fitPadding(map: maplibregl.Map): maplibregl.PaddingOptions {
  const { width, height } = map.getCanvas().getBoundingClientRect()
  const desktop = width >= 768
  return {
    top: 60,
    right: 60,
    bottom: desktop ? 60 : Math.min(height * 0.45, 320),
    left: desktop ? Math.min(width * 0.32, 420) : 60,
  }
}

/**
 * Widens the camera just enough to bring the highlighted reservoirs into view
 * alongside the searched point. Clamped at both ends: never below
 * RESERVOIR_MINZOOM (where the markers stop drawing, so a fit that "worked"
 * would show nothing) and never tighter than the zoom the search already set.
 */
export function fitReservoirsInView(
  map: maplibregl.Map,
  centre: [number, number],
  points: [number, number][],
  opts: { animate: boolean; maxZoom: number },
): void {
  if (points.length === 0) return
  const bounds = new maplibre.LngLatBounds(centre, centre)
  for (const p of points) bounds.extend(p)

  const camera = map.cameraForBounds(bounds, { padding: fitPadding(map) })
  if (!camera || camera.zoom === undefined) return
  const zoom = Math.min(Math.max(camera.zoom, RESERVOIR_MINZOOM), opts.maxZoom)
  const centreOfBounds = camera.center as maplibregl.LngLatLike

  if (!opts.animate) map.jumpTo({ center: centreOfBounds, zoom })
  else map.easeTo({ center: centreOfBounds, zoom, duration: 900 })
}

export function bindMapInteractions(map: maplibregl.Map): void {
  bindLocationPicker(map)

  const clearSelection = () => {
    if (selectedReservoirId !== undefined) {
      map.setFeatureState({ source: 'reservoirs-src', id: selectedReservoirId }, { selected: false })
      selectedReservoirId = undefined
    }
  }

  map.on('mouseenter', 'reservoirs-circle', e => {
    map.getCanvas().style.cursor = 'pointer'
    const f = e.features?.[0]
    if (!f) return
    // Only the pinned marker skips its hover popup — it already shows more.
    // Other markers still hover normally.
    if (detailPopup && f.id !== undefined && f.id === selectedReservoirId) return
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
    clearSelection()
    selectedReservoirId = f.id
    if (selectedReservoirId !== undefined) {
      map.setFeatureState({ source: 'reservoirs-src', id: selectedReservoirId }, { selected: true })
    }

    hoverPopup?.remove()
    hoverPopup = null
    detailPopup?.remove()
    const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number]
    detailPopup = new maplibre.Popup({ offset: 16, maxWidth: '240px', closeOnClick: false })
      .setLngLat(coords)
      .setDOMContent(reservoirDetailContent(f.properties as unknown as ReservoirProps))
      .addTo(map)
    detailPopup.on('close', () => {
      detailPopup = null
      clearSelection()
    })

    // Only meaningful once a search exists — the workspace panel is not
    // mounted on the entry view, so the popup carries the detail there.
    if (useAppStore.getState().view === 'searched') {
      useAppStore.getState().selectDataset('reservoirs')
    }
  })
}

/**
 * Points the burnt-area overlay at the searched place.
 *
 * MapLibre fetches a GeoJSON source given a URL, so the layer loads the same
 * query the panel used and the browser cache serves one of the two. Nothing is
 * drawn until the reader turns the overlay on.
 */
export function updateFireHistorySource(map: maplibregl.Map, coords: { lat: number; lng: number }): void {
  const src = map.getSource('fire-history-src') as maplibregl.GeoJSONSource | undefined
  if (!src) return
  src.setData(fireHistoryQueryUrl(coords))
}
