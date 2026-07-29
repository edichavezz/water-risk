import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import PanelBody from './PanelBody'

const WIDTH_BY_DEPTH: Record<string, string> = {
  list: 'w-[340px]',
  detail: 'w-[440px]',
  interpretation: 'w-[500px]',
}

export default function WorkspacePanel() {
  const { t } = useTranslation()
  const location = useAppStore(s => s.location)
  const panelDepth = useAppStore(s => s.panelDepth)
  const goHome = useAppStore(s => s.goHome)
  if (!location) return null

  return (
    <aside
      className={`absolute bottom-6 left-6 top-16 z-10 hidden flex-col rounded-2xl bg-canvas p-4 shadow-xl transition-[width] duration-[var(--dur-panel)] md:flex ${
        WIDTH_BY_DEPTH[panelDepth]
      } max-w-[calc(100vw-3rem)]`}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink">
            {location.municipality || location.displayName.split(',')[0]}
          </p>
          {location.provinceName && <p className="text-xs text-muted">{location.provinceName}</p>}
        </div>
        <button
          onClick={goHome}
          className="min-h-11 rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-subtle-cool"
        >
          {t('panel.home')}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <PanelBody />
      </div>
    </aside>
  )
}
