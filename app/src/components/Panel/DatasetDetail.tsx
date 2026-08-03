import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { getDataset } from '../../registry/datasets'
import { resultSummary } from './resultSummary'
import { requestInterpretation } from '../../services/ai'
import { formatDateTime, formatLongDate } from '../../i18n/formatDate'
import type {
  ActiveFireResult, FireDangerResult, FireHistoryResult,
  FloodZoneResult, CoastalZoning, DroughtStatus,
} from '../../types'
import type { SupplyAnswer } from '../../types/supply'
import ReservoirLevels from './ReservoirLevels'
import CoastalZoningDetail from './CoastalZoningDetail'

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
  const supply =
    id === 'reservoirs' && result?.status === 'available'
      ? (result.data as SupplyAnswer)
      : undefined
  const reservoirs = supply?.reservoirs.length ? supply.reservoirs : undefined
  const coastalZoning =
    id === 'coastalFlood' && result?.status === 'available'
      ? (result.data as CoastalZoning)
      : undefined
  // Drought carries the date of the slice actually served, the same way
  // reservoirs carry REDIAM's reading date — and says so when it is old.
  const drought =
    id === 'drought' && result?.status === 'available'
      ? (result.data as DroughtStatus)
      : undefined
  const fireDanger =
    id === 'fireDanger' && result?.status === 'available'
      ? (result.data as FireDangerResult)
      : undefined
  const activeFire =
    id === 'activeFire' && result?.status === 'available'
      ? (result.data as ActiveFireResult)
      : undefined
  const fireHistory =
    id === 'fireHistory' && result?.status === 'available'
      ? (result.data as FireHistoryResult)
      : undefined
  const reservoirAsOf = reservoirs?.[0]?.fillPercentAsOf
  // Names the system the highlighted markers belong to, so the map emphasis is
  // attributable rather than just decorative.
  const reservoirScope = reservoirs?.length
    ? t('panel.summary.reservoirs.supplyScope', { system: reservoirs[0].systemName ?? '' })
    : null

  const explain = () => {
    openAiMode()
    void requestInterpretation({ type: 'dataset', id })
  }

  return (
    /* The mode tabs stay above this view in PanelBody — the back link returns
       to the list within the same tab, it does not replace the tabs. */
    <div className="flex flex-col gap-3">
      <button
        onClick={backToList}
        className="-my-2 flex min-h-11 items-center gap-1.5 self-start text-[12.5px] font-bold text-primary hover:text-primary-hover"
      >
        <span aria-hidden>←</span> {t('panel.back')}
      </button>

      <h2 className="font-display text-xl font-semibold leading-tight text-ink">
        {t(`registry.${id}.name`)}
      </h2>
      <p className="-mt-1 text-sm text-ink">{resultSummary(id, result, t)}</p>
      {floodNote && <p className="-mt-1.5 text-[12.5px] text-muted">{floodNote}</p>}
      {reservoirScope && <p className="-mt-1.5 text-[12.5px] text-muted">{reservoirScope}</p>}
      {reservoirAsOf && (
        <p className="-mt-1.5 text-[11px] text-muted">
          {t('map.reservoir.asOf', { date: formatLongDate(reservoirAsOf) })}
        </p>
      )}

      {/* One line per provenance tier, stating exactly what its source knows.
          A registry answer must never borrow a curated answer's phrasing. */}
      {supply && supply.provenance !== 'none' && (
        <p className="text-[11.5px] leading-relaxed text-muted">
          {supply.provenance === 'curated'
            ? t('supply.curated', { system: supply.systemName ?? '' })
            : supply.provenance === 'official-registry'
              ? t('supply.officialRegistry')
              : t('supply.basin')}
        </p>
      )}

      {supply?.networks.length ? (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-[.04em] text-muted">
            {t('supply.networksLabel')}
          </p>
          <ul className="flex flex-col gap-0.5">
            {supply.networks.map(n => (
              <li key={n.code} className="text-[12px] text-ink">{n.name}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {reservoirs && <ReservoirLevels reservoirs={reservoirs} />}

      {coastalZoning && <CoastalZoningDetail zoning={coastalZoning} />}

      {drought && (
        <div className="flex flex-col gap-1">
          <p className="text-[11px] text-muted">
            {drought.updatedAt
              ? t('panel.drought.asOf', { date: formatLongDate(drought.updatedAt) })
              : t('panel.drought.dateUnknown')}
          </p>
          {drought.stale && (
            <p className="text-[11.5px] font-bold text-accent-ink">
              {t('panel.drought.stale', { days: drought.ageDays })}
            </p>
          )}
        </div>
      )}

      {fireDanger && (
        <p className="text-[11px] text-muted">
          {t('panel.fireDanger.forDate', { date: formatLongDate(fireDanger.forDate) })}
        </p>
      )}

      {activeFire?.detections.length ? (
        <ul aria-label={t('registry.activeFire.name')} className="flex flex-col gap-2">
          {activeFire.detections.slice(0, 10).map(detection => (
            <li key={detection.id} className="rounded-lg bg-accent-soft/60 px-3 py-2">
              <p className="text-[12px] font-bold text-ink">
                {formatDateTime(detection.detectedAt)}
              </p>
              <p className="text-[11.5px] text-muted">
                {detection.distanceKm} km · {detection.satellite} · {detection.confidence}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {fireHistory?.fires.length ? (
        <ul aria-label={t('registry.fireHistory.name')} className="flex flex-col gap-2">
          {fireHistory.fires.slice(0, 10).map((fire, index) => (
            <li key={`${fire.date}-${fire.distanceKm}-${index}`} className="rounded-lg bg-accent-soft/60 px-3 py-2">
              <p className="text-[12px] font-bold text-ink">{formatLongDate(fire.date)}</p>
              {(fire.commune || fire.province) && (
                <p className="text-[11.5px] text-ink">
                  {[fire.commune, fire.province].filter(Boolean).join(', ')}
                </p>
              )}
              <p className="text-[11.5px] text-muted">{fire.areaHa} ha · {fire.distanceKm} km</p>
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-[5px] text-[11.5px]">
        <dt className="font-bold text-muted">{t('panel.cadence')}</dt>
        <dd className="text-ink">{t(`registry.${id}.cadence`)}</dd>
        <dt className="font-bold text-muted">{t('panel.geography')}</dt>
        <dd className="text-ink">{t(`registry.${id}.resolution`)}</dd>
        <dt className="font-bold text-muted">{t('legend.source', { source: '' }).replace(/:\s*$/, '')}</dt>
        <dd className="text-ink">{def.source.name}</dd>
      </dl>

      {/* Outlined rather than filled: the limitations are a caveat to read,
          not a warning block competing with the result above them. */}
      <div className="rounded-xl border border-[#E9D9C2] p-3.5">
        <p className="mb-1.5 text-[11.5px] font-bold text-accent-ink">{t('panel.doesNotShow')}</p>
        <ul className="list-disc ps-4 text-[11.5px] leading-relaxed text-[#4A3A2C]">
          {limitations.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </div>

      {def.source.url && (
        <a
          href={def.source.url}
          target="_blank"
          rel="noreferrer"
          className="self-start text-[12.5px] font-bold text-primary underline hover:text-primary-hover"
        >
          {t('panel.sourceLink')}
        </a>
      )}

      {def.aiAllowed && (
        <button
          onClick={explain}
          className="min-h-11 rounded-[10px] bg-primary px-3 py-2.5 text-[13px] font-bold text-white hover:bg-primary-hover"
        >
          {t('panel.explain')} <span aria-hidden>→</span>
        </button>
      )}
    </div>
  )
}
