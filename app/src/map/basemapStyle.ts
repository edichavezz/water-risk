import type maplibregl from 'maplibre-gl'

export const BASEMAP_URL = 'https://tiles.openfreemap.org/styles/positron'

export function quietFocusTransform(
  style: maplibregl.StyleSpecification,
): maplibregl.StyleSpecification {
  return {
    ...style,
    layers: style.layers.filter(l => !l.id.toLowerCase().includes('poi')),
  }
}

export async function loadQuietFocusStyle(): Promise<maplibregl.StyleSpecification> {
  const res = await fetch(BASEMAP_URL)
  if (!res.ok) throw new Error(`Basemap style fetch failed: ${res.status}`)
  return quietFocusTransform(await res.json())
}
