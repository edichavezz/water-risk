import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { orderedDatasets, type DatasetDef } from '../../registry/datasets'
import { hasResult, isListedHere, rankByAvailability } from '../../registry/ordering'
import type { HazardFamily } from '../../types/workspace'
import DatasetRow from './DatasetRow'

/**
 * Past this many empty rows the tail is collapsed behind a count.
 *
 * The list runs to ten rows now, and outside Andalucía most of the bundled
 * registers have nothing to say — so a persistent grey tail is the common case,
 * not the exception. Three or fewer stays open, because a short gap reads more
 * easily than a disclosure.
 */
const COLLAPSE_ABOVE = 3

const FAMILIES: HazardFamily[] = ['water', 'fire']

function Group({ hazard, defs }: { hazard: HazardFamily; defs: DatasetDef[] }) {
  const { t } = useTranslation()
  const results = useAppStore(s => s.results)
  const [showEmpty, setShowEmpty] = useState(false)

  // Rows carrying a reading first, in relevance order; the rest below, so the
  // break reads as deliberate rather than as more list.
  const ranked = rankByAvailability(defs, results)
  const withResult = ranked.filter(d => hasResult(results[d.id]))
  const empty = ranked.filter(d => !hasResult(results[d.id]))
  const collapsed = empty.length > COLLAPSE_ABOVE && !showEmpty

  return (
    <section>
      {/* Same two families, same order, as the layers card — so the structure
          reads as one idea wherever the reader meets it. */}
      <h3
        className={`pb-0.5 pt-3 text-[10px] font-bold uppercase tracking-[.04em] ${
          hazard === 'fire' ? 'text-accent' : 'text-primary'
        }`}
      >
        {t(`hazard.${hazard}`)}
      </h3>

      {withResult.map(d => (
        <DatasetRow key={d.id} def={d} />
      ))}

      {empty.length > 0 &&
        (collapsed ? (
          <button
            type="button"
            onClick={() => setShowEmpty(true)}
            aria-expanded={false}
            /* Muted and never green: a collapsed row the reader does not open
               must still not read as "nothing wrong here". */
            className="flex min-h-11 w-full items-center border-t border-hairline-soft text-left text-[11px] text-muted hover:text-ink"
          >
            {t('panel.noResultCount', { count: empty.length })}
          </button>
        ) : (
          <Fragment>
            <p className="mt-3 pb-1 text-[10px] font-bold uppercase tracking-[.04em] text-muted">
              {t('panel.noResultGroup')}
            </p>
            {empty.map(d => (
              <DatasetRow key={d.id} def={d} />
            ))}
          </Fragment>
        ))}
    </section>
  )
}

export default function DatasetList() {
  const { t } = useTranslation()
  const location = useAppStore(s => s.location)
  const audience = useAppStore(s => s.audience)
  const results = useAppStore(s => s.results)
  const coverage = useAppStore(s => s.coverage)
  if (!location) return null

  // Only `not_applicable` rows are dropped. `unsupported` ones stay: the
  // question is real here and we have no source, and hiding that would let
  // absence read as absence of risk.
  const relevant = orderedDatasets(location, audience).filter(d => isListedHere(d.id, results))

  return (
    /* Each row draws its own top hairline; the list closes the last one off,
       so the run of rules reads as a table rather than a trailing edge. */
    <div className="flex flex-col border-b border-hairline-soft">
      {FAMILIES.map(hazard => {
        const defs = relevant.filter(d => d.hazard === hazard)
        return defs.length ? <Group key={hazard} hazard={hazard} defs={defs} /> : null
      })}

      {/* How much of the picture this place gets, in place of the "outside
          coverage" screen that used to replace the list entirely. The counts
          come from the registry, so this can never quote a number of checks
          the app does not actually run. */}
      {coverage && (
        <p className="pt-3 text-[10.5px] leading-relaxed text-muted">
          {t(`coverage.tier.${coverage.tier}`, {
            count: coverage.coveredCount,
            total: coverage.totalCount,
          })}
        </p>
      )}
    </div>
  )
}
