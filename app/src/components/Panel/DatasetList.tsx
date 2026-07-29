import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { orderedDatasets, type DatasetDef } from '../../registry/datasets'
import { hasResult, rankByAvailability } from '../../registry/ordering'
import type { HazardFamily } from '../../types/workspace'
import DatasetRow from './DatasetRow'

/**
 * Past this many empty rows the tail is collapsed behind a count.
 *
 * The list is ~13 rows once fire lands, and outside Andalucía most of the
 * bundled registers have nothing to say — so a persistent grey tail is the
 * common case, not the exception. Three or fewer stays open, because a short
 * gap is easier to read than a disclosure.
 */
const COLLAPSE_ABOVE = 3

const FAMILIES: HazardFamily[] = ['water', 'fire']

function Group({ hazard, defs }: { hazard: HazardFamily; defs: DatasetDef[] }) {
  const { t } = useTranslation()
  const results = useAppStore(s => s.results)
  const [showEmpty, setShowEmpty] = useState(false)

  // Rows carrying a reading first, in relevance order; the rest below a
  // divider, so the break reads as deliberate rather than as more list.
  const ranked = rankByAvailability(defs, results)
  const withResult = ranked.filter(d => hasResult(results[d.id]))
  const empty = ranked.filter(d => !hasResult(results[d.id]))

  const collapsed = empty.length > COLLAPSE_ABOVE && !showEmpty

  return (
    <section className="flex flex-col gap-2">
      {/* Same two families, same order, as the map layers card and the About
          page — so the structure reads as one idea in all three places. */}
      <h3
        className={`px-1 text-[11px] font-bold uppercase tracking-wide ${
          hazard === 'fire' ? 'text-accent' : 'text-primary'
        }`}
      >
        {t(`hazard.${hazard}`)}
      </h3>

      {withResult.map(d => (
        <DatasetRow key={d.id} def={d} />
      ))}

      {empty.length > 0 && (
        <Fragment>
          {collapsed ? (
            <button
              type="button"
              onClick={() => setShowEmpty(true)}
              aria-expanded={false}
              /* Muted, never green: a collapsed row the reader does not open
                 must still not read as "nothing wrong here". */
              className="min-h-11 rounded-xl bg-subtle-warm px-3 py-2 text-left text-xs text-muted hover:bg-subtle-cool"
            >
              {t('panel.noResultCount', { count: empty.length })}
            </button>
          ) : (
            <Fragment>
              <p className="mt-1 px-1 text-xs font-bold text-muted">
                {t('panel.noResultGroup')}
              </p>
              {empty.map(d => (
                <DatasetRow key={d.id} def={d} />
              ))}
            </Fragment>
          )}
        </Fragment>
      )}
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

  const relevant = orderedDatasets(location, audience)
    // not_applicable datasets are omitted from the default list (spec §9.2)
    .filter(d => results[d.id]?.status !== 'not_applicable')

  return (
    <div className="flex flex-col gap-4">
      {FAMILIES.map(hazard => {
        const defs = relevant.filter(d => d.hazard === hazard)
        return defs.length ? <Group key={hazard} hazard={hazard} defs={defs} /> : null
      })}

      {/* Says how much of the picture this place gets, in place of the
          "outside coverage" screen that used to replace the list entirely.
          Counts come from the registry, so this can never quote a number of
          checks the app does not run. */}
      {coverage && (
        <p className="px-1 text-xs leading-relaxed text-muted">
          {t(`coverage.tier.${coverage.tier}`, {
            count: coverage.coveredCount,
            total: coverage.totalCount,
          })}
        </p>
      )}
    </div>
  )
}
