import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { orderedDatasets } from '../../registry/datasets'
import { rankByAvailability } from '../../registry/ordering'
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

  // Three lines is all the peek shows, so spend them on rows that have a
  // reading — same ranking the full list uses.
  const signals = rankByAvailability(orderedDatasets(location, audience), results).slice(0, 3)

  return (
    <section
      className={`fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl bg-canvas p-5 shadow-[0_-8px_28px_rgba(30,42,56,.18)] transition-[height] duration-[var(--dur-panel)] md:hidden ${HEIGHT[position]}`}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold leading-tight text-ink">
            {location.municipio || location.displayName.split(',')[0]}
          </p>
          {location.provincia && (
            <p className="truncate text-[11.5px] text-muted">{location.provincia}</p>
          )}
        </div>
        {/* Explicit controls, not gesture-only (spec §11.3) */}
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={cycleDown}
            aria-label={t('sheet.collapse')}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline text-ink hover:bg-subtle-cool"
          >
            <span aria-hidden>▾</span>
          </button>
          <button
            onClick={cycleUp}
            aria-label={t('sheet.expand')}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline text-ink hover:bg-subtle-cool"
          >
            <span aria-hidden>▴</span>
          </button>
        </div>
      </div>

      {position === 'peek' ? (
        <ul className="overflow-hidden text-[11.5px]">
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
