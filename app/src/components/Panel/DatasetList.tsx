import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { orderedDatasets } from '../../registry/datasets'
import { hasResult, rankByAvailability } from '../../registry/ordering'
import DatasetRow from './DatasetRow'

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

  // Rows carrying a reading come first, in relevance order; the rest follow
  // under a divider, so the break reads as deliberate rather than as more list.
  const datasets = rankByAvailability(relevant, results)
  const firstEmpty = datasets.findIndex(d => !hasResult(results[d.id]))

  return (
    <div className="flex flex-col gap-2">
      {datasets.map((d, i) => (
        <Fragment key={d.id}>
          {i === firstEmpty && (
            <p className="mt-1 px-1 text-xs font-bold text-muted">{t('panel.noResultGroup')}</p>
          )}
          <DatasetRow def={d} />
        </Fragment>
      ))}

      {/* Says how much of the picture this place gets, in place of the
          "outside coverage" screen that used to replace the list entirely.
          Counts come from the registry, so this can never quote a number of
          checks the app does not run. */}
      {coverage && (
        <p className="mt-2 px-1 text-xs leading-relaxed text-muted">
          {t(`coverage.tier.${coverage.tier}`, {
            count: coverage.coveredCount,
            total: coverage.totalCount,
          })}
        </p>
      )}
    </div>
  )
}
