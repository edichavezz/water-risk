import type { DatasetId } from '../types/workspace'

export const DATASET_MAP_LAYERS: Record<DatasetId, string[]> = {
  flood: ['flood-t500', 'flood-t100', 'flood-t10'],
  drought: ['drought-layer'],
  coastalFlood: ['coastal-tramos', 'coastal-zsp'],
  groundwater: ['groundwater-fill', 'groundwater-line'],
  reservoirs: ['reservoirs-halo', 'reservoirs-circle', 'reservoirs-label', 'reservoirs-name'],
  fireDanger: ['fire-danger-layer'],
  fireHistory: ['fire-history-fill', 'fire-history-line'],
  waterQuality: [],
  bathingWater: [],
  firePrevention: [],
}

export function visibleLayerIds(primary: DatasetId | null, context: DatasetId[]): Set<string> {
  const ids = new Set<string>()
  if (primary) for (const id of DATASET_MAP_LAYERS[primary]) ids.add(id)
  for (const c of context) for (const id of DATASET_MAP_LAYERS[c]) ids.add(id)
  return ids
}
