import type maplibregl from 'maplibre-gl'

// Module-level handle to the single MapLibre instance, so non-React map helpers
// (layer manager, interactions) can reach it without prop-drilling.
export const mapRef: { current: maplibregl.Map | null } = { current: null }
