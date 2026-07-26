import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
// maplibre-gl.css is imported (into a cascade layer) from index.css — importing
// it here too would re-inject it unlayered and beat every Tailwind utility.
import { useAppStore } from '../../store/useAppStore'
import { loadQuietFocusStyle, BASEMAP_URL } from '../../map/basemapStyle'
import { addCoverageLayers, ENTRY_CENTER, ENTRY_ZOOM } from '../../map/coverageLayers'
import { ensureDataLayers, applyLayerPlan, bindMapInteractions } from '../../map/dataLayers'
import { mapRef } from '../../map/mapRef'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const view = useAppStore(s => s.view)
  const location = useAppStore(s => s.location)
  const searchOrigin = useAppStore(s => s.searchOrigin)
  const primaryLayer = useAppStore(s => s.primaryLayer)
  const contextLayers = useAppStore(s => s.contextLayers)

  // ── Bootstrap the single map instance ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    ;(async () => {
      let style: maplibregl.StyleSpecification | string
      try { style = await loadQuietFocusStyle() } catch { style = BASEMAP_URL }
      if (cancelled || !containerRef.current) return
      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: ENTRY_CENTER,
        zoom: ENTRY_ZOOM,
        attributionControl: false,
        pitchWithRotate: false,
        maxPitch: 0,
      })
      map.addControl(new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
          '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> · ' +
          '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a>',
      }), 'bottom-right')
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      map.addControl(new maplibregl.ScaleControl(), 'bottom-left')
      map.on('load', () => {
        addCoverageLayers(map)
        ensureDataLayers(map)
        bindMapInteractions(map)
        const { primaryLayer: p, contextLayers: c } = useAppStore.getState()
        applyLayerPlan(map, p, c)
      })
      mapRef.current = map
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // ── Apply the layer plan when primary/context layers change ──────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    applyLayerPlan(map, primaryLayer, contextLayers)
  }, [primaryLayer, contextLayers])

  // ── Camera follows workspace state ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (view === 'searched' && location) {
      const { lat, lng } = location.coordinates
      markerRef.current?.remove()
      const el = document.createElement('div')
      el.style.cssText =
        'width:20px;height:20px;border-radius:50% 50% 50% 0;background:#285F77;' +
        'border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(32,49,42,.35)'
      markerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat]).addTo(map)
      // A typed query lands at a fixed zoom; a point the user picked on the
      // map keeps the zoom they were already reading at.
      const zoom = searchOrigin === 'map' ? map.getZoom() : 11
      if (prefersReducedMotion()) map.jumpTo({ center: [lng, lat], zoom })
      else if (searchOrigin === 'map') map.easeTo({ center: [lng, lat], zoom, duration: 600 })
      else map.flyTo({ center: [lng, lat], zoom, duration: 1200, essential: true })
    } else if (view === 'entry') {
      markerRef.current?.remove()
      markerRef.current = null
      if (prefersReducedMotion()) map.jumpTo({ center: ENTRY_CENTER, zoom: ENTRY_ZOOM })
      else map.flyTo({ center: ENTRY_CENTER, zoom: ENTRY_ZOOM, duration: 900 })
    }
  }, [view, location, searchOrigin])

  return <div ref={containerRef} className="absolute inset-0" aria-label="Map" role="application" />
}
