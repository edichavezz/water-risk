import type { Coordinates, DroughtStatus } from '../types'

// Copernicus EDO WMS
const EDO_WMS = 'https://edo.jrc.ec.europa.eu/geoserver/edo/wms'

// CDI colour values → drought level mapping
// The CDI uses standard colour coding per the EDO specification
const CDI_COLOUR_MAP: Record<string, DroughtStatus['level']> = {
  // RGB values from Copernicus CDI colour scheme (approximate)
  // Green shades = no drought / recovery
  // Yellow = watch
  // Orange = warning
  // Red = alert
  '255,0,0': 'alert',
  '255,128,0': 'warning',
  '255,255,0': 'watch',
  '0,128,0': 'none',
  '0,255,0': 'recovery',
  '128,255,0': 'partial_recovery',
}

export function getDroughtWmsUrl(): string {
  return (
    `${EDO_WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
    `&LAYERS=cdi_current&STYLES=&FORMAT=image/png&TRANSPARENT=true` +
    `&SRS=EPSG:3857&WIDTH=256&HEIGHT=256` +
    `&BBOX={bbox-epsg-3857}`
  )
}

export async function getDroughtStatus(coords: Coordinates): Promise<DroughtStatus> {
  const delta = 0.05
  const bbox = `${coords.lng - delta},${coords.lat - delta},${coords.lng + delta},${coords.lat + delta}`

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    LAYERS: 'cdi_current',
    QUERY_LAYERS: 'cdi_current',
    STYLES: '',
    BBOX: bbox,
    WIDTH: '10',
    HEIGHT: '10',
    SRS: 'EPSG:4326',
    X: '5',
    Y: '5',
    INFO_FORMAT: 'text/plain',
    FEATURE_COUNT: '1',
  })

  try {
    const res = await fetch(`${EDO_WMS}?${params}`)
    if (!res.ok) throw new Error('EDO WMS failed')
    const text = await res.text()

    // Parse CDI value from plain text response
    // EDO returns something like: "CDI_value = 3" or similar
    const cdiMatch = text.match(/CDI[_\s]*[Vv]alue\s*[=:]\s*(-?\d+\.?\d*)/i)
    if (cdiMatch) {
      const value = parseFloat(cdiMatch[1])
      return cdiValueToStatus(value)
    }

    // Try to find any numeric value
    const numMatch = text.match(/\b([1-5])\b/)
    if (numMatch) {
      return cdiValueToStatus(parseInt(numMatch[1]))
    }
  } catch {
    // Fall through to unknown
  }

  return {
    level: 'unknown',
    label: 'unknown',
    updatedAt: new Date().toISOString().split('T')[0],
    source: 'Copernicus EDO',
  }
}

// CDI values: 1=alert, 2=warning, 3=watch, 4=partial_recovery, 5=recovery/none
function cdiValueToStatus(value: number): DroughtStatus {
  const today = new Date().toISOString().split('T')[0]
  const levelMap: Record<number, DroughtStatus['level']> = {
    1: 'alert',
    2: 'warning',
    3: 'watch',
    4: 'partial_recovery',
    5: 'none',
  }
  const level = levelMap[Math.round(value)] ?? 'unknown'
  return { level, label: level, updatedAt: today, source: 'Copernicus EDO' }
}
