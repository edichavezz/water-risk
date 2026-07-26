import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { getDataset } from '../../registry/datasets'
import { resultSummary } from './resultSummary'
import { requestInterpretation } from '../../services/ai'
import { formatLongDate } from '../../i18n/formatDate'
import type { FloodZoneResult, Reservoir } from '../../types'

export default function DatasetDetail() {
  const { t } = useTranslation()
  const id = useAppStore(s => s.selectedDataset)
  const result = useAppStore(s => (id ? s.results[id] : undefined))
  const backToList = useAppStore(s => s.backToList)
  const openAiMode = useAppStore(s => s.openAiMode)
  if (!id) return null

  const def = getDataset(id)
  const limitations = t(`registry.${id}.limitations`, { returnObjects: true }) as string[]

  // Flood: separate the source finding from a property-level conclusion (§7.4)
  const floodNote =
    id === 'flood' && result?.status === 'available' && !(result.data as FloodZoneResult).inZone
      ? t('panel.summary.flood.detailNote')
      : null

  // Reservoirs carry REDIAM's own reading date, so the levels are dated rather
  // than left to read as "current" (spec §9.2).
  const reservoirAsOf =
    id === 'reservoirs' && result?.status === 'available'
      ? (result.data as Reservoir[])[0]?.fillPercentAsOf
      : undefined

  const explain = () => {
    openAiMode()
    void requestInterpretation({ type: 'dataset', id })
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={backToList}
        className="flex min-h-11 items-center gap-1 self-start text-sm font-bold text-primary hover:text-primary-hover"
      >
        <span aria-hidden>←</span> {t('panel.back')}
      </button>

      <h2 className="text-lg font-bold text-ink">{t(`registry.${id}.name`)}</h2>
      <p className="text-base text-ink">{resultSummary(id, result, t)}</p>
      {floodNote && <p className="text-sm text-muted">{floodNote}</p>}
      {reservoirAsOf && (
        <p className="text-xs text-muted">
          {t('map.reservoir.asOf', { date: formatLongDate(reservoirAsOf) })}
        </p>
      )}

      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="font-bold text-muted">{t('panel.cadence')}</dt>
        <dd className="text-ink">{t(`registry.${id}.cadence`)}</dd>
        <dt className="font-bold text-muted">{t('panel.geography')}</dt>
        <dd className="text-ink">{t(`registry.${id}.resolution`)}</dd>
        <dt className="font-bold text-muted">{t('legend.source', { source: '' }).replace(/:\s*$/, '')}</dt>
        <dd className="text-ink">{def.source.name}</dd>
      </dl>

      <div className="rounded-xl bg-subtle-warm p-3">
        <p className="mb-1 text-xs font-bold text-ink">{t('panel.doesNotShow')}</p>
        <ul className="list-disc pl-4 text-xs text-ink">
          {limitations.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </div>

      {def.source.url && (
        <a
          href={def.source.url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-bold text-primary hover:text-primary-hover"
        >
          {t('panel.sourceLink')}
        </a>
      )}

      {def.aiAllowed && (
        <button
          onClick={explain}
          className="min-h-11 rounded-lg bg-primary-soft px-3 py-2 text-sm font-bold text-primary hover:bg-primary hover:text-white"
        >
          {t('panel.explain')}
        </button>
      )}
    </div>
  )
}
