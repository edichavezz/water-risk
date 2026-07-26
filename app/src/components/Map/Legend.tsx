import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { getDataset } from '../../registry/datasets'
import type { DatasetId } from '../../types/workspace'

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
      return [
        { color: '#4B91AD', opacity: 0.55, label: t('legend.coastalFlood.servidumbre') },
        { color: '#4B91AD', opacity: 0.35, label: t('legend.coastalFlood.policia') },
      ]
    case 'groundwater':
      return [{ color: '#B87535', opacity: 0.5, label: t('legend.groundwater.over') }]
    default:
      return []
  }
}

export default function Legend() {
  const { t } = useTranslation()
  const primaryLayer = useAppStore(s => s.primaryLayer)
  if (!primaryLayer) return null

  const def = getDataset(primaryLayer)
  const rows = legendRows(primaryLayer, t)

  return (
    <div className="absolute bottom-8 left-4 z-10 max-w-[240px] rounded-xl bg-canvas/95 p-3 text-xs shadow-md">
      <p className="mb-1.5 font-bold text-ink">{t(`registry.${primaryLayer}.name`)}</p>
      <ul className="space-y-1">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm"
              style={{ background: r.color, opacity: r.opacity ?? 1 }}
            />
            <span className="text-ink">{r.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-muted">{t('legend.source', { source: def.source.name })}</p>
      <p className="text-muted">{t(`registry.${primaryLayer}.cadence`)}</p>
    </div>
  )
}
