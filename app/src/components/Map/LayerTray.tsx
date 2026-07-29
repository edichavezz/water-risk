import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { DATASETS, type DatasetDef } from '../../registry/datasets'
import type { DatasetId, HazardFamily } from '../../types/workspace'

const FAMILIES: HazardFamily[] = ['water', 'fire']

function FamilyLabel({ hazard }: { hazard: HazardFamily }) {
  const { t } = useTranslation()
  return (
    <p
      className={`mt-3 mb-1 text-[11px] font-bold uppercase tracking-wide ${
        hazard === 'fire' ? 'text-accent' : 'text-primary'
      }`}
    >
      {t(`hazard.${hazard}`)}
    </p>
  )
}

export default function LayerTray() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const primaryLayer = useAppStore(s => s.primaryLayer)
  const contextLayers = useAppStore(s => s.contextLayers)
  const setPrimaryLayer = useAppStore(s => s.setPrimaryLayer)
  const toggleContextLayer = useAppStore(s => s.toggleContextLayer)

  const primaries = DATASETS.filter(d => d.mapRole === 'primary')
  const contexts = DATASETS.filter(d => d.mapRole === 'context')

  const byFamily = (defs: DatasetDef[], hazard: HazardFamily) =>
    defs.filter(d => d.hazard === hazard)

  const primaryOption = (d: DatasetDef) => (
    <label
      key={d.id}
      title={d.mapUnavailable ? t('layers.unavailable') : undefined}
      className={`flex min-h-11 items-center gap-2 text-sm ${d.mapUnavailable ? 'text-muted' : ''}`}
    >
      <input
        type="radio"
        name="primary"
        checked={primaryLayer === d.id}
        disabled={d.mapUnavailable}
        onChange={() => setPrimaryLayer(d.id as DatasetId)}
      />
      {t(`registry.${d.id}.name`)}
      {d.mapUnavailable && <span className="text-xs">({t('layers.unavailable')})</span>}
    </label>
  )

  // Two active layers from different families is the mix most likely to turn
  // to mud, so the warning fires on that as well as on the count.
  const activeFamilies = new Set(
    [primaryLayer, ...contextLayers]
      .filter((id): id is DatasetId => !!id)
      .map(id => DATASETS.find(d => d.id === id)?.hazard),
  )
  const mixedFamilies = activeFamilies.size > 1

  return (
    <div className="absolute top-16 right-14 z-10">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="min-h-11 rounded-lg bg-canvas px-3 py-2 text-sm font-bold text-ink shadow-md hover:bg-subtle-cool"
      >
        {t('layers.button')}
      </button>
      {open && (
        <div className="mt-2 w-64 rounded-xl bg-canvas p-4 shadow-lg">
          <p className="mb-1 text-xs font-bold text-muted">{t('layers.primaryHeading')}</p>
          {/* One radiogroup rendered in two labelled sections, not two groups:
              the budget is one primary across both families, so arrow keys must
              move across the family boundary. */}
          <p className="mb-2 text-[11px] text-muted">{t('layers.primaryNote')}</p>
          <div role="radiogroup" aria-label={t('layers.primaryHeading')}>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="radio"
                name="primary"
                checked={primaryLayer === null}
                onChange={() => setPrimaryLayer(null)}
              />
              {t('layers.none')}
            </label>
            {FAMILIES.map(hazard => {
              const defs = byFamily(primaries, hazard)
              if (!defs.length) return null
              return (
                <div key={hazard}>
                  <FamilyLabel hazard={hazard} />
                  {defs.map(primaryOption)}
                </div>
              )
            })}
          </div>

          <p className="mb-1 mt-4 text-xs font-bold text-muted">{t('layers.contextHeading')}</p>
          {FAMILIES.map(hazard => {
            const defs = byFamily(contexts, hazard)
            if (!defs.length) return null
            return (
              <div key={hazard}>
                <FamilyLabel hazard={hazard} />
                {defs.map(d => (
                  <label key={d.id} className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={contextLayers.includes(d.id)}
                      onChange={() => toggleContextLayer(d.id)}
                    />
                    {t(`registry.${d.id}.name`)}
                  </label>
                ))}
              </div>
            )
          })}

          {contextLayers.length >= 2 && (
            <p className="mt-2 text-xs text-warning">{t('layers.readabilityWarning')}</p>
          )}
          {mixedFamilies && (
            <p className="mt-2 text-xs text-warning">{t('layers.mixedFamilyWarning')}</p>
          )}
        </div>
      )}
    </div>
  )
}
