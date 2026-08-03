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
 * Whether the panel should list this dataset at all.
 *
 * Only `not_applicable` rules a row out — the question does not arise here, so
 * there is nothing to say. `unsupported` deliberately stays listed: the
 * question is real and we have no source, and hiding that would let absence
 * read as absence of risk.
 */
export function isListedHere(
  id: DatasetId,
  results: Partial<Record<DatasetId, DatasetResult>>,
): boolean {
  return results[id]?.status !== 'not_applicable'
}

/**
 * Whether the layer tray should offer this dataset's map layer.
 *
 * Stricter than `isListedHere`, and the gap between them is the point: an
 * `unsupported` dataset still earns a visible row saying we have no source,
 * but there is nothing to paint, so the toggle is disabled rather than
 * offering a layer that would draw nothing.
 *
 * Deliberately looser than `hasResult`, though: `unavailable` and `error` mean
 * this *point* has no reading, not that the layer paints nothing. The flood and
 * drought rasters still show the zones around a location that sits outside one,
 * which is often the reason to turn them on.
 */
export function isDrawableHere(
  id: DatasetId,
  results: Partial<Record<DatasetId, DatasetResult>>,
): boolean {
  const status = results[id]?.status
  // These two layers are meaningful only for the exact dated response fetched
  // for this search. Unlike a static flood-zone raster, an unavailable current
  // slice must not fall back to painting some service default.
  if (id === 'fireDanger' || id === 'activeFire') return status === 'available'
  return status !== 'not_applicable' && status !== 'unsupported'
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
