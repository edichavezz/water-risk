import type { DatasetId } from '../types/workspace'

export const DATASET_MAP_LAYERS: Record<DatasetId, string[]> = {
  flood: ['flood-t500', 'flood-t100', 'flood-t10'],
  drought: ['drought-layer'],
  coastalFlood: ['coastal-tramos', 'coastal-zsp'],
  // No map layer — the source data was fabricated and has been removed.
  groundwater: [],
  reservoirs: ['reservoirs-halo', 'reservoirs-circle', 'reservoirs-label', 'reservoirs-name'],
  waterQuality: [],
  bathingWater: [],
}

export function visibleLayerIds(primary: DatasetId | null, context: DatasetId[]): Set<string> {
  const ids = new Set<string>()
  if (primary) for (const id of DATASET_MAP_LAYERS[primary]) ids.add(id)
  for (const c of context) for (const id of DATASET_MAP_LAYERS[c]) ids.add(id)
  return ids
}
