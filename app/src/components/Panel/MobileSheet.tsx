import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { orderedDatasets } from '../../registry/datasets'
import { resultSummary } from './resultSummary'
import PanelBody from './PanelBody'

type Position = 'peek' | 'half' | 'full'

const HEIGHT: Record<Position, string> = {
  peek: 'h-28',
  half: 'h-[50dvh]',
  // Stops short of the app header, which sits above the sheet at z-30.
  full: 'h-[calc(100dvh-4.5rem)]',
}

export default function MobileSheet() {
  const { t } = useTranslation()
  const [position, setPosition] = useState<Position>('peek')
  const location = useAppStore(s => s.location)
  const audience = useAppStore(s => s.audience)
  const results = useAppStore(s => s.results)
  const panelDepth = useAppStore(s => s.panelDepth)
  const panelMode = useAppStore(s => s.panelMode)

  // Selecting a row (or opening AI) raises the sheet to full.
  useEffect(() => {
    if (panelDepth === 'detail' || panelMode === 'ai') setPosition('full')
  }, [panelDepth, panelMode])

  if (!location) return null

  const cycleUp = () => setPosition(p => (p === 'peek' ? 'half' : 'full'))
  const cycleDown = () => setPosition(p => (p === 'full' ? 'half' : 'peek'))

  const signals = orderedDatasets(location, audience).slice(0, 3)

  return (
    <section
      className={`fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl bg-canvas p-4 shadow-2xl transition-[height] duration-[var(--dur-panel)] md:hidden ${HEIGHT[position]}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">
            {location.municipio || location.displayName.split(',')[0]}
          </p>
          {location.provincia && <p className="text-xs text-muted">{location.provincia}</p>}
        </div>
        {/* Explicit controls, not gesture-only (spec §11.3) */}
        <div className="flex shrink-0 gap-1">
          <button
            onClick={cycleDown}
            aria-label={t('sheet.collapse')}
            className="min-h-11 min-w-11 rounded-lg bg-subtle-warm px-3 font-bold text-ink hover:bg-subtle-cool"
          >
            <span aria-hidden>▾</span>
          </button>
          <button
            onClick={cycleUp}
            aria-label={t('sheet.expand')}
            className="min-h-11 min-w-11 rounded-lg bg-subtle-warm px-3 font-bold text-ink hover:bg-subtle-cool"
          >
            <span aria-hidden>▴</span>
          </button>
        </div>
      </div>

      {position === 'peek' ? (
        <ul className="overflow-hidden text-xs">
          {signals.map(d => (
            <li key={d.id} className="truncate text-ink">
              <span className="font-bold">{t(`registry.${d.id}.name`)}: </span>
              {resultSummary(d.id, results[d.id], t)}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <PanelBody />
        </div>
      )}
    </section>
  )
}
