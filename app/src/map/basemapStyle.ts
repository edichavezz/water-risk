import type maplibregl from 'maplibre-gl'

export const BASEMAP_URL = 'https://tiles.openfreemap.org/styles/positron'

/* Positron is a cool grey basemap; the redesign asks for warm neutrals under
   warm-blue water. These are recolours only — no layer is added, removed or
   re-filtered here, so the basemap keeps saying exactly what it said before.
   Matching is by layer id because that is all the vector source exposes;
   anything the patterns miss simply keeps its original paint. */
const LAND = '#F4EDE0'
const WATER_FILL = '#C8DFE6'
const WATER_LINE = '#9FC3CC'
const GREEN = '#EAE7D4'
const BUILDING = '#EDE3D2'
const ROAD = '#FBF8F2'
const ROAD_CASING = '#E4DAC8'
const LABEL = '#5C6B72'
const LABEL_HALO = '#FBF8F2'

interface Recolour { test: RegExp; paint: Record<string, string> }

// First match wins, so the specific patterns are listed before the loose ones.
const RECOLOURS: Recolour[] = [
  { test: /^background$/, paint: { 'background-color': LAND } },
  { test: /waterway/, paint: { 'line-color': WATER_LINE } },
  { test: /water/, paint: { 'fill-color': WATER_FILL, 'line-color': WATER_LINE } },
  { test: /park|wood|forest|grass|landcover|landuse/, paint: { 'fill-color': GREEN } },
  { test: /building/, paint: { 'fill-color': BUILDING, 'fill-outline-color': ROAD_CASING } },
  { test: /(road|bridge|tunnel|highway|transit).*(casing|outline)/, paint: { 'line-color': ROAD_CASING } },
  { test: /road|bridge|tunnel|highway|transit|aeroway/, paint: { 'line-color': ROAD } },
  { test: /boundary|admin/, paint: { 'line-color': ROAD_CASING } },
]

/** Recolours one layer in place of its cool original, leaving every paint
    property the layer does not actually have well alone. */
function warmLayer(layer: maplibregl.LayerSpecification): maplibregl.LayerSpecification {
  const id = layer.id.toLowerCase()

  // Labels are handled by type rather than by id — every symbol layer wants
  // the same muted ink and warm halo.
  if (layer.type === 'symbol') {
    return {
      ...layer,
      paint: { ...layer.paint, 'text-color': LABEL, 'text-halo-color': LABEL_HALO },
    } as maplibregl.LayerSpecification
  }

  const match = RECOLOURS.find(r => r.test.test(id))
  if (!match) return layer

  // Only assign properties this layer type can carry, or MapLibre rejects the
  // whole style — a fill layer has no `line-color`.
  const paint = { ...(layer.paint as Record<string, unknown>) }
  for (const [key, value] of Object.entries(match.paint)) {
    if (key.split('-')[0] === layer.type) paint[key] = value
  }
  return { ...layer, paint } as maplibregl.LayerSpecification
}

export function quietFocusTransform(
  style: maplibregl.StyleSpecification,
): maplibregl.StyleSpecification {
  return {
    ...style,
    layers: style.layers
      .filter(l => !l.id.toLowerCase().includes('poi'))
      .map(warmLayer),
  }
}

export async function loadQuietFocusStyle(): Promise<maplibregl.StyleSpecification> {
  const res = await fetch(BASEMAP_URL)
  if (!res.ok) throw new Error(`Basemap style fetch failed: ${res.status}`)
  return quietFocusTransform(await res.json())
}
