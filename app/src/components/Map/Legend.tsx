import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { getDataset } from '../../registry/datasets'
import type { DatasetId } from '../../types/workspace'
import type { Reservoir } from '../../types'

interface Row { color: string; opacity?: number; label: string }

function legendRows(primary: DatasetId, t: (k: string) => string): Row[] {
  switch (primary) {
    case 'flood':
      return [
        { color: '#4B91AD', opacity: 0.45, label: t('legend.flood.t10') },
        { color: '#4B91AD', opacity: 0.40, label: t('legend.flood.t100') },
        { color: '#4B91AD', opacity: 0.35, label: t('legend.flood.t500') },
      ]
    case 'drought':
      return [
        { color: '#EAB308', label: t('legend.drought.watch') },
        { color: '#B87535', label: t('legend.drought.warning') },
        { color: '#AD4942', label: t('legend.drought.alert') },
      ]
    case 'coastalFlood':
      // Swatches match what REDIAM actually draws — yellow profile transects
      // and pink management stretches — not the 20 m / 100 m strips the dead
      // MITECO layers used to show.
      return [
        { color: '#E8C33C', label: t('legend.coastalFlood.perfiles') },
        { color: '#D081B4', label: t('legend.coastalFlood.tramos') },
      ]
    case 'groundwater':
      return [{ color: '#B87535', opacity: 0.5, label: t('legend.groundwater.over') }]
    default:
      return []
  }
}

/**
 * The key to what is currently drawn on the map. No longer a floating card of
 * its own: the layer tray and the legend answer the same question, so this
 * renders as the tray's bottom section, under a hairline divider. Returns
 * null when nothing is drawn, taking its divider with it.
 */
export default function Legend() {
  const { t } = useTranslation()
  const primaryLayer = useAppStore(s => s.primaryLayer)
  const contextLayers = useAppStore(s => s.contextLayers)
  const reservoirResult = useAppStore(s => s.results.reservoirs)

  // The ringed markers need a key, or the reader is left guessing what the
  // emphasis means.
  const highlighted =
    contextLayers.includes('reservoirs') && reservoirResult?.status === 'available'
      ? (reservoirResult.data as Reservoir[])
      : []

  if (!primaryLayer && highlighted.length === 0) return null

  const def = primaryLayer ? getDataset(primaryLayer) : null
  const rows = primaryLayer ? legendRows(primaryLayer, t) : []

  return (
    <div className="border-t border-hairline-soft pt-3">
      <p className="mb-[7px] text-[10.5px] font-bold uppercase tracking-[.04em] text-muted">
        {t('layers.legendHeading')}
      </p>

      {primaryLayer && def && (
        <>
          <ul className="space-y-1">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[11px]">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: r.color, opacity: r.opacity ?? 1 }}
                />
                <span className="text-ink">{r.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] text-muted">
            {t('legend.source', { source: def.source.name })}
          </p>
          <p className="text-[10px] text-muted">{t(`registry.${primaryLayer}.cadence`)}</p>
        </>
      )}

      {highlighted.length > 0 && (
        <ul className={`space-y-1 ${primaryLayer ? 'mt-2.5' : ''}`}>
          <li className="flex items-center gap-1.5 text-[11px]">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#4B91AD]"
              /* Matches the ring `dataLayers` actually strokes on the map —
                 the swatch has to keep agreeing with the paint. */
              style={{ boxShadow: '0 0 0 2px #204E62' }}
            />
            <span className="text-ink">{t('legend.reservoirs.supply')}</span>
          </li>
          <li className="flex items-center gap-1.5 text-[11px]">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#4B91AD] opacity-35"
            />
            <span className="text-muted">{t('legend.reservoirs.other')}</span>
          </li>
        </ul>
      )}
    </div>
  )
}
