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
  const coverage = useAppStore(s => s.coverage)
  const results = useAppStore(s => s.results)
  if (!location) return null

  const relevant = orderedDatasets(location, audience)
    .filter(d => !coverage || coverage.datasets.length === 0 || coverage.datasets.includes(d.id))
    // not_applicable datasets are omitted from the default list (spec §9.2)
    .filter(d => results[d.id]?.status !== 'not_applicable')

  // Rows carrying a reading come first, in relevance order; the rest follow
  // under a divider, so the break reads as deliberate rather than as more list.
  const datasets = rankByAvailability(relevant, results)
  const firstEmpty = datasets.findIndex(d => !hasResult(results[d.id]))

  return (
    /* Each row draws its own top hairline; the list closes the last one off,
       so the run of rules reads as a table rather than a trailing edge. */
    <div className="flex flex-col border-b border-hairline-soft">
      {datasets.map((d, i) => (
        <Fragment key={d.id}>
          {i === firstEmpty && (
            <p className="mt-3 pb-1 text-[10px] font-bold uppercase tracking-[.04em] text-micro">
              {t('panel.noResultGroup')}
            </p>
          )}
          <DatasetRow def={d} />
        </Fragment>
      ))}
    </div>
  )
}
