import type { DatasetId, DatasetResult } from '../types/workspace'
import type { DatasetDef } from './datasets'

/**
 * Rank a dataset by how much it can tell the reader right now.
 *
 * `available` and `loading` share rank 0 on purpose. Results land one fetch at
 * a time, so if a value outranked a pending fetch, settled rows would climb
 * past unsettled ones and the list would reshuffle under the reader's eye.
 * Sharing the rank makes reordering monotonic: every row starts at 0 and
 * either stays or drops exactly once, so nothing ever moves up.
 */
function rank(result: DatasetResult | undefined): number {
  switch (result?.status ?? 'loading') {
    case 'available':
    case 'loading':
      return 0
    // No value, but the row carries a Retry button — worth keeping above the
    // rows where nothing can be done.
    case 'error':
      return 1
    default:
      return 2
  }
}

export function hasResult(result: DatasetResult | undefined): boolean {
  return rank(result) === 0
}

/**
 * Whether a dataset applies to the place currently being looked at.
 *
 * Two things rule one out: the coverage record for this area not listing it,
 * or the check itself coming back `not_applicable` — a coastal layer for an
 * inland town. Either way there is nothing to say and nothing to draw, so the
 * panel omits the row *and* the layer tray disables the toggle. Sharing one
 * predicate is what stops those two drifting apart and offering a map layer
 * for a dataset the panel will not even list.
 *
 * Deliberately narrower than `hasResult`: `unavailable` and `error` mean this
 * point has no reading, not that the layer paints nothing. The flood and
 * drought rasters still show the zones around a location that sits outside
 * one, which is often the reason to turn them on.
 */
export function isApplicableHere(
  id: DatasetId,
  coverage: { datasets: DatasetId[] } | null,
  results: Partial<Record<DatasetId, DatasetResult>>,
): boolean {
  if (coverage && coverage.datasets.length > 0 && !coverage.datasets.includes(id)) return false
  return results[id]?.status !== 'not_applicable'
}

/**
 * Relevance order, re-sorted so rows that carry a value come first. Sorting is
 * stable, so the incoming relevance order survives inside each rank.
 *
 * Kept separate from `orderedDatasets` because that function also decides
 * fetch order, where no result exists yet.
 */
export function rankByAvailability(
  defs: DatasetDef[],
  results: Partial<Record<DatasetId, DatasetResult>>,
): DatasetDef[] {
  return [...defs].sort((a, b) => rank(results[a.id]) - rank(results[b.id]))
}
