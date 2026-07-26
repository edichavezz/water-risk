import { useAppStore } from '../../store/useAppStore'
import { orderedDatasets } from '../../registry/datasets'
import DatasetRow from './DatasetRow'

export default function DatasetList() {
  const location = useAppStore(s => s.location)
  const audience = useAppStore(s => s.audience)
  const coverage = useAppStore(s => s.coverage)
  const results = useAppStore(s => s.results)
  if (!location) return null

  const datasets = orderedDatasets(location, audience)
    .filter(d => !coverage || coverage.datasets.length === 0 || coverage.datasets.includes(d.id))
    // not_applicable datasets are omitted from the default list (spec §9.2)
    .filter(d => results[d.id]?.status !== 'not_applicable')

  return (
    <div className="flex flex-col gap-2">
      {datasets.map(d => <DatasetRow key={d.id} def={d} />)}
    </div>
  )
}
