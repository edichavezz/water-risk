import type { PlaceContext } from '../types/place'
import type { DatasetId, DatasetResult } from '../types/workspace'
import type { DatasetDef } from '../registry/datasets'

export interface OrchestratorCallbacks {
  onResult: (id: DatasetId, result: DatasetResult) => void
}

/**
 * Fetches every dataset that has something to say here, and records a status
 * for the ones that do not.
 *
 * Datasets that do not apply are short-circuited rather than skipped, and that
 * is a correctness point, not an optimisation. Before this, `flood` applied
 * everywhere: searching in Italy would sample three SNCZI layers, fail all
 * three, throw, and land as `error` — offering the reader a Retry button that
 * could never succeed. `unsupported` is the truthful state, and it is a
 * NON_SAFE status, so nothing about the honesty rule is lost.
 */
export async function runProfile(
  place: PlaceContext,
  datasets: DatasetDef[],
  cb: OrchestratorCallbacks,
): Promise<void> {
  const live: DatasetDef[] = []

  for (const d of datasets) {
    const applies = d.applicability(place)
    if (applies === 'covered') {
      cb.onResult(d.id, { status: 'loading' })
      live.push(d)
    } else {
      cb.onResult(d.id, { status: applies })
    }
  }

  await Promise.all(
    live.map(async d => {
      try {
        cb.onResult(d.id, await d.fetch(place))
      } catch (e) {
        cb.onResult(d.id, { status: 'error', error: e instanceof Error ? e.message : String(e) })
      }
    }),
  )
}
