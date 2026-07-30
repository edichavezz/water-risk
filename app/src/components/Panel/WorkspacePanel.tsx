import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import PanelBody from './PanelBody'

const WIDTH_BY_DEPTH: Record<string, string> = {
  list: 'w-[340px]',
  detail: 'w-[360px]',
  interpretation: 'w-[360px]',
}

export default function WorkspacePanel() {
  const { t } = useTranslation()
  const location = useAppStore(s => s.location)
  const panelDepth = useAppStore(s => s.panelDepth)
  const goHome = useAppStore(s => s.goHome)
  if (!location) return null

  return (
    /* Anchored at the top only. Height comes from the content plus padding —
       anchoring both top and bottom stretched the panel over the map even
       when it had four rows to show. `max-h` keeps a long list scrollable
       without ever forcing the panel to fill the viewport. */
    <aside
      className={`absolute left-8 top-[88px] z-10 hidden max-h-[calc(100dvh-7.5rem)] flex-col overflow-y-auto rounded-2xl bg-canvas p-5 shadow-[0_10px_28px_rgba(30,42,56,.16)] transition-[width] duration-[var(--dur-panel)] md:flex ${
        WIDTH_BY_DEPTH[panelDepth]
      } max-w-[calc(100vw-4rem)]`}
    >
      <header className="mb-3.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-[17px] font-semibold leading-tight text-ink">
            {location.municipality || location.displayName.split(',')[0]}
          </p>
          {location.provinceName && (
            <p className="truncate text-[11.5px] text-muted">{location.provinceName}</p>
          )}
        </div>
        <button
          onClick={goHome}
          className="-my-2 shrink-0 rounded-lg px-1 py-2 text-xs font-bold text-primary hover:text-primary-hover"
        >
          {t('panel.home')}
        </button>
      </header>

      <PanelBody />
    </aside>
  )
}
