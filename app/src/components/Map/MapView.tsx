import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useAppStore } from '../../store/useAppStore'
import { getSNCZIWmsUrl, SNCZI_LAYERS } from '../../services/floodZone'
import { getDroughtWmsUrl } from '../../services/drought'
import { getAllReservoirsGeoJSON } from '../../services/reservoirs'
import { getCoastalWmsUrl, COASTAL_LAYERS } from '../../services/coastalFlood'
import groundwaterUnits from '../../data/groundwater-units.json'

const ANDALUCIA_CENTER: [number, number] = [-4.5, 37.5]
const DEFAULT_ZOOM = 7

export default function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)

  const { activeLayers, profile } = useAppStore()

  // ── Initialise map ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: ANDALUCIA_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    })

    map.addControl(
      new maplibregl.AttributionControl({
        customAttribution:
          '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> · ' +
          '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a> · ' +
          'Flood: MITERD SNCZI · Drought: Copernicus EDO · Reservoirs: REDIAM',
        compact: true,
      }),
      'bottom-right'
    )
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left')

    map.on('load', () => {
      // ── Flood zone WMS layers (SNCZI) ─────────────────────────────────
      const floodLayerDefs = [
        { id: 'flood-t500', layer: SNCZI_LAYERS.T500, opacity: 0.45 },
        { id: 'flood-t100', layer: SNCZI_LAYERS.T100, opacity: 0.50 },
        { id: 'flood-t10',  layer: SNCZI_LAYERS.T10,  opacity: 0.55 },
      ]
      floodLayerDefs.forEach(({ id, layer, opacity }) => {
        map.addSource(`${id}-source`, {
          type: 'raster',
          tiles: [getSNCZIWmsUrl(layer)],
          tileSize: 256,
          attribution: 'SNCZI — MITERD',
        })
        map.addLayer({
          id,
          type: 'raster',
          source: `${id}-source`,
          paint: { 'raster-opacity': opacity },
          layout: { visibility: 'none' },
        })
      })

      // ── Drought WMS layer (Copernicus EDO) ────────────────────────────
      map.addSource('drought-source', {
        type: 'raster',
        tiles: [getDroughtWmsUrl()],
        tileSize: 256,
        attribution: 'Copernicus EDO',
      })
      map.addLayer({
        id: 'drought-layer',
        type: 'raster',
        source: 'drought-source',
        paint: { 'raster-opacity': 0.6 },
        layout: { visibility: 'none' },
      })

      // ── Reservoir GeoJSON layer ───────────────────────────────────────
      map.addSource('reservoirs', {
        type: 'geojson',
        data: getAllReservoirsGeoJSON(),
      })

      // Outer ring — white halo for readability
      map.addLayer({
        id: 'reservoirs-halo',
        type: 'circle',
        source: 'reservoirs',
        paint: {
          'circle-radius': 11,
          'circle-color': '#ffffff',
          'circle-opacity': 0.85,
          'circle-stroke-width': 0,
        },
        layout: { visibility: 'none' },
      })

      // Fill circle — colour-coded by fill %
      map.addLayer({
        id: 'reservoirs-circle',
        type: 'circle',
        source: 'reservoirs',
        paint: {
          'circle-radius': 9,
          'circle-color': ['get', 'colour'],
          'circle-opacity': 0.9,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        },
        layout: { visibility: 'none' },
      })

      // Label — fill % number inside the circle
      map.addLayer({
        id: 'reservoirs-label',
        type: 'symbol',
        source: 'reservoirs',
        layout: {
          'text-field': ['concat', ['to-string', ['get', 'fillPercent']], '%'],
          'text-size': 9,
          'text-font': ['Noto Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          visibility: 'none',
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.2)',
          'text-halo-width': 0.5,
        },
      })

      // Name label below the circle
      map.addLayer({
        id: 'reservoirs-name',
        type: 'symbol',
        source: 'reservoirs',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
          'text-offset': [0, 1.6],
          'text-anchor': 'top',
          'text-max-width': 10,
          'text-allow-overlap': false,
          visibility: 'none',
        },
        paint: {
          'text-color': '#1e3a5f',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      })

      // ── Coastal DPH WMS layers (MITERD) ───────────────────────────────
      const coastalLayerDefs = [
        { id: 'coastal-policia', layer: COASTAL_LAYERS.policia, opacity: 0.35 },
        { id: 'coastal-servidumbre', layer: COASTAL_LAYERS.servidumbre, opacity: 0.5 },
      ]
      coastalLayerDefs.forEach(({ id, layer, opacity }) => {
        map.addSource(`${id}-source`, {
          type: 'raster',
          tiles: [getCoastalWmsUrl(layer)],
          tileSize: 256,
          attribution: 'MITERD Costas',
        })
        map.addLayer({
          id,
          type: 'raster',
          source: `${id}-source`,
          paint: { 'raster-opacity': opacity },
          layout: { visibility: 'none' },
        })
      })

      // ── Groundwater overexploited units (IGME) ────────────────────────
      map.addSource('groundwater-units', {
        type: 'geojson',
        data: groundwaterUnits as GeoJSON.FeatureCollection,
      })
      map.addLayer({
        id: 'groundwater-fill',
        type: 'fill',
        source: 'groundwater-units',
        paint: { 'fill-color': '#b45309', 'fill-opacity': 0.18 },
        layout: { visibility: 'none' },
      })
      map.addLayer({
        id: 'groundwater-outline',
        type: 'line',
        source: 'groundwater-units',
        paint: { 'line-color': '#b45309', 'line-width': 1.5 },
        layout: { visibility: 'none' },
      })

      // ── Reservoir click popup ─────────────────────────────────────────
      map.on('click', 'reservoirs-circle', (e) => {
        if (!e.features?.length) return
        const props = e.features[0].properties as {
          name: string
          fillPercent: number
          historicalMeanPercent: number | null
          basin: string
          colour: string
        }
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]

        const meanLine = props.historicalMeanPercent != null
          ? `<div style="color:#6b7280;font-size:11px;margin-top:2px">Historical mean: ${props.historicalMeanPercent}%</div>`
          : ''

        const barBg = props.fillPercent < 25 ? '#ef4444' : props.fillPercent < 40 ? '#f97316' : props.fillPercent < 60 ? '#eab308' : '#3b82f6'
        const bar = `
          <div style="margin:6px 0 2px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;position:relative">
            <div style="width:${props.fillPercent}%;height:100%;background:${barBg};border-radius:3px"></div>
            ${props.historicalMeanPercent != null ? `<div style="position:absolute;top:0;bottom:0;left:${props.historicalMeanPercent}%;width:2px;background:#9ca3af"></div>` : ''}
          </div>`

        popupRef.current?.remove()
        popupRef.current = new maplibregl.Popup({ offset: 14, closeButton: true, maxWidth: '220px' })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:system-ui,sans-serif;padding:2px">
              <div style="font-weight:600;font-size:13px;color:#1e3a5f;margin-bottom:2px">${props.name}</div>
              <div style="font-size:11px;color:#6b7280">${props.basin} basin</div>
              <div style="font-size:22px;font-weight:700;color:${barBg};margin:4px 0 0">${props.fillPercent}%</div>
              <div style="color:#6b7280;font-size:11px">current capacity</div>
              ${bar}
              ${meanLine}
            </div>
          `)
          .addTo(map)
      })

      map.on('mouseenter', 'reservoirs-circle', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'reservoirs-circle', () => {
        map.getCanvas().style.cursor = ''
      })
    })

    mapRef.current = map
    return () => {
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [])

  // ── Sync layer visibility ───────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    const setVis = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    }

    setVis('flood-t500', activeLayers.flood)
    setVis('flood-t100', activeLayers.flood)
    setVis('flood-t10', activeLayers.flood)
    setVis('drought-layer', activeLayers.drought)

    const res = activeLayers.reservoirs
    setVis('reservoirs-halo', res)
    setVis('reservoirs-circle', res)
    setVis('reservoirs-label', res)
    setVis('reservoirs-name', res)

    setVis('coastal-policia', activeLayers.coastal)
    setVis('coastal-servidumbre', activeLayers.coastal)
    setVis('groundwater-fill', activeLayers.groundwater)
    setVis('groundwater-outline', activeLayers.groundwater)
  }, [activeLayers])

  // ── Highlight nearby reservoirs when a profile is loaded ───────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded() || !map.getSource('reservoirs')) return
    if (!profile) return

    const nearbyNames = new Set(profile.reservoirs.map(r => r.name))

    // Pulse the nearby ones by enlarging their stroke
    map.setPaintProperty('reservoirs-circle', 'circle-stroke-width', [
      'case',
      ['in', ['get', 'name'], ['literal', [...nearbyNames]]],
      3,
      1.5,
    ])
    map.setPaintProperty('reservoirs-circle', 'circle-stroke-color', [
      'case',
      ['in', ['get', 'name'], ['literal', [...nearbyNames]]],
      '#1d4ed8',
      '#ffffff',
    ])
  }, [profile?.reservoirs])

  // ── Fly to location + place search marker ──────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !profile) return

    const { lat, lng } = profile.location.coordinates

    markerRef.current?.remove()

    let colour = '#3b82f6'
    if (profile.floodZone?.inZone) colour = '#ef4444'
    else if (profile.drought?.level === 'alert') colour = '#f59e0b'

    const el = document.createElement('div')
    el.style.cssText = `
      width: 22px; height: 22px; border-radius: 50% 50% 50% 0;
      background: ${colour}; border: 2px solid white;
      transform: rotate(-45deg); box-shadow: 0 2px 6px rgba(0,0,0,.35);
      cursor: pointer;
    `

    markerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([lng, lat])
      .addTo(map)

    map.flyTo({ center: [lng, lat], zoom: 11, duration: 1400, essential: true })
  }, [profile?.location.coordinates])

  return <div ref={mapContainerRef} className="w-full h-full" />
}
