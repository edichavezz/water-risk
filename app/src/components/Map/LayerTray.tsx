import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { DATASETS } from '../../registry/datasets'
import type { DatasetId } from '../../types/workspace'

export default function LayerTray() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const primaryLayer = useAppStore(s => s.primaryLayer)
  const contextLayers = useAppStore(s => s.contextLayers)
  const setPrimaryLayer = useAppStore(s => s.setPrimaryLayer)
  const toggleContextLayer = useAppStore(s => s.toggleContextLayer)

  const primaries = DATASETS.filter(d => d.mapRole === 'primary')
  const contexts = DATASETS.filter(d => d.mapRole === 'context')
  const n = (primaryLayer ? 1 : 0) + contextLayers.length

  return (
    <div className="absolute top-4 right-14 z-10">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="min-h-11 rounded-lg bg-canvas px-3 py-2 text-sm font-bold text-ink shadow-md hover:bg-subtle-cool"
      >
        {t('layers.button', { n })}
      </button>
      {open && (
        <div className="mt-2 w-64 rounded-xl bg-canvas p-4 shadow-lg">
          <p className="mb-2 text-xs font-bold text-muted">{t('layers.primaryHeading')}</p>
          <div role="radiogroup" aria-label={t('layers.primaryHeading')}>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="radio" name="primary" checked={primaryLayer === null}
                onChange={() => setPrimaryLayer(null)} />
              {t('layers.none')}
            </label>
            {primaries.map(d => (
              <label key={d.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="radio" name="primary" checked={primaryLayer === d.id}
                  onChange={() => setPrimaryLayer(d.id as DatasetId)} />
                {t(`registry.${d.id}.name`)}
              </label>
            ))}
          </div>
          <p className="mb-2 mt-3 text-xs font-bold text-muted">{t('layers.contextHeading')}</p>
          {contexts.map(d => (
            <label key={d.id} className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={contextLayers.includes(d.id)}
                onChange={() => toggleContextLayer(d.id)} />
              {t(`registry.${d.id}.name`)}
            </label>
          ))}
          {contextLayers.length >= 2 && (
            <p className="mt-2 text-xs text-warning">{t('layers.readabilityWarning')}</p>
          )}
        </div>
      )}
    </div>
  )
}
