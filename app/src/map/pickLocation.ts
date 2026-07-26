import type maplibregl from 'maplibre-gl'
import maplibre from 'maplibre-gl'
import i18n from '../i18n'
import type { Coordinates, SearchResult } from '../types'
import { reverseGeocode } from '../services/geocoding'
import { lookupCoverage } from '../services/coverage'
import { submitLocation } from '../components/Entry/submitLocation'

// Layers that own their own click behaviour. A click landing on one of these
// belongs to that handler, not to location picking.
const INTERACTIVE_LAYERS = ['reservoirs-circle']

export type PickState =
  | { status: 'found'; result: SearchResult; inCoverage: boolean }
  | { status: 'empty' }

export function hitsInteractiveLayer(
  map: maplibregl.Map,
  point: maplibregl.Point | { x: number; y: number },
): boolean {
  const layers = INTERACTIVE_LAYERS.filter(id => map.getLayer?.(id))
  const hits = map.queryRenderedFeatures(point as maplibregl.Point, { layers })
  return hits.length > 0
}

// Resolves a clicked point to a pick state, returning null for any response
// that a newer pick has already superseded.
export function createPickResolver() {
  let current = 0
  return {
    async resolve(coords: Coordinates): Promise<PickState | null> {
      const seq = ++current
      const result = await reverseGeocode(coords).catch(() => null)
      if (seq !== current) return null
      if (!result) return { status: 'empty' }
      return { status: 'found', result, inCoverage: lookupCoverage(coords).supported }
    },
  }
}

// ── Popup rendering ────────────────────────────────────────────────────────

function loadingContent(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pick-popup'
  el.textContent = i18n.t('map.pickLoading')
  return el
}

function stateContent(state: PickState, onConfirm: (r: SearchResult) => void): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pick-popup'

  if (state.status === 'empty') {
    el.textContent = i18n.t('map.pickNoPlace')
    return el
  }

  const { result, inCoverage } = state
  const name = document.createElement('div')
  name.className = 'pick-popup__name'
  name.textContent = result.municipio || result.displayName.split(',')[0]
  if (result.provincia) name.textContent += ` · ${result.provincia}`
  el.append(name)

  if (!inCoverage) {
    const note = document.createElement('div')
    note.className = 'pick-popup__note'
    note.textContent = i18n.t('map.pickOutsideCoverage')
    el.append(note)
  }

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'pick-popup__action'
  button.textContent = i18n.t('map.pickSearchHere')
  button.addEventListener('click', () => onConfirm(result))
  el.append(button)
  return el
}

export function bindLocationPicker(map: maplibregl.Map): void {
  const resolver = createPickResolver()
  let popup: maplibregl.Popup | null = null
  let marker: maplibregl.Marker | null = null

  const dismiss = () => {
    popup?.remove()
    popup = null
    marker?.remove()
    marker = null
  }

  map.on('click', e => {
    if (hitsInteractiveLayer(map, e.point)) return
    dismiss()

    const coords = { lat: e.lngLat.lat, lng: e.lngLat.lng }

    // A hollow pin, deliberately unlike the filled marker a confirmed result
    // gets, so a provisional pick never reads as a completed search.
    const pinEl = document.createElement('div')
    pinEl.className = 'pick-pin'
    marker = new maplibre.Marker({ element: pinEl, anchor: 'bottom' })
      .setLngLat([coords.lng, coords.lat])
      .addTo(map)

    popup = new maplibre.Popup({ offset: 26, maxWidth: '220px', closeOnClick: false })
      .setLngLat([coords.lng, coords.lat])
      .setDOMContent(loadingContent())
      .addTo(map)
    popup.on('close', () => { marker?.remove(); marker = null })

    const opened = popup
    void resolver.resolve(coords).then(state => {
      if (!state || popup !== opened) return
      opened.setDOMContent(stateContent(state, result => {
        dismiss()
        void submitLocation(result, 'map')
      }))
    })
  })

  // Document-level: the map canvas only sees key events while focused, and a
  // pick is usually made with the pointer, leaving focus elsewhere.
  const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
  document.addEventListener('keydown', onKeyDown)
  map.on('remove', () => document.removeEventListener('keydown', onKeyDown))
}
