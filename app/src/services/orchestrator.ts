import type { SearchResult } from '../types'
import type { DatasetId, DatasetResult } from '../types/workspace'
import type { DatasetDef } from '../registry/datasets'

export interface OrchestratorCallbacks {
  onResult: (id: DatasetId, result: DatasetResult) => void
}

export async function runProfile(
  location: SearchResult,
  datasets: DatasetDef[],
  cb: OrchestratorCallbacks,
): Promise<void> {
  for (const d of datasets) cb.onResult(d.id, { status: 'loading' })
  await Promise.all(
    datasets.map(async d => {
      try {
        cb.onResult(d.id, await d.fetch(location))
      } catch (e) {
        cb.onResult(d.id, { status: 'error', error: e instanceof Error ? e.message : String(e) })
      }
    }),
  )
}
