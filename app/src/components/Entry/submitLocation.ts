import type { SearchResult } from '../../types'
import type { DatasetId } from '../../types/workspace'
import { useAppStore } from '../../store/useAppStore'
import { orderedDatasets, getDataset } from '../../registry/datasets'
import { runProfile } from '../../services/orchestrator'

// Enters the searched state and fetches the applicable datasets. Outside
// coverage it shows the location but runs no dataset fetches and applies no
// risk styling (spec §15.2).
export async function submitLocation(location: SearchResult): Promise<void> {
  const store = useAppStore.getState()
  store.beginSearch(location)
  const coverage = useAppStore.getState().coverage
  if (!coverage?.supported) return
  const datasets = orderedDatasets(location, useAppStore.getState().audience)
    .filter(d => coverage.datasets.includes(d.id))
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
