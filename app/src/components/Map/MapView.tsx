import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '../../store/useAppStore'
import { loadQuietFocusStyle, BASEMAP_URL } from '../../map/basemapStyle'
import { addCoverageLayers, ENTRY_CENTER, ENTRY_ZOOM } from '../../map/coverageLayers'
import { mapRef } from '../../map/mapRef'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const view = useAppStore(s => s.view)
  const location = useAppStore(s => s.location)

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
      map.on('load', () => addCoverageLayers(map))
      mapRef.current = map
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

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
      if (prefersReducedMotion()) map.jumpTo({ center: [lng, lat], zoom: 11 })
      else map.flyTo({ center: [lng, lat], zoom: 11, duration: 1200, essential: true })
    } else if (view === 'entry') {
      markerRef.current?.remove()
      markerRef.current = null
      if (prefersReducedMotion()) map.jumpTo({ center: ENTRY_CENTER, zoom: ENTRY_ZOOM })
      else map.flyTo({ center: ENTRY_CENTER, zoom: ENTRY_ZOOM, duration: 900 })
    }
  }, [view, location])

  return <div ref={containerRef} className="absolute inset-0" aria-label="Map" role="application" />
}
