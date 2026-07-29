import type { PlaceContext } from '../../types/place'
import type { DatasetId } from '../../types/workspace'
import { useAppStore, type SearchOrigin } from '../../store/useAppStore'
import { orderedDatasets, getDataset } from '../../registry/datasets'
import { runProfile } from '../../services/orchestrator'

/**
 * Enters the searched state and runs the profile.
 *
 * There is no coverage gate here any more. Every dataset is handed to the
 * orchestrator, which fetches the ones that apply and records an honest status
 * for the rest — so a search in Marseille returns a real list with visible gaps
 * rather than the "outside coverage" dead end it used to hit.
 */
export async function submitLocation(
  location: PlaceContext,
  origin: SearchOrigin = 'query',
): Promise<void> {
  const store = useAppStore.getState()
  store.beginSearch(location, origin)
  const datasets = orderedDatasets(location, useAppStore.getState().audience)
  await runProfile(location, datasets, {
    onResult: (id, result) => useAppStore.getState().setResult(id, result),
  })
}

// Re-fetch a single dataset (used by row-level retry).
export async function retryDataset(id: DatasetId): Promise<void> {
  const { location } = useAppStore.getState()
  if (!location) return
  await runProfile(location, [getDataset(id)], {
    onResult: (dsId, result) => useAppStore.getState().setResult(dsId, result),
  })
}
