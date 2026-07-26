import MapView from './components/Map/MapView'
import LayerTray from './components/Map/LayerTray'
import Legend from './components/Map/Legend'
import EntryCard from './components/Entry/EntryCard'
import CoverageKey from './components/Entry/CoverageKey'
import WorkspacePanel from './components/Panel/WorkspacePanel'
import MobileSheet from './components/Panel/MobileSheet'
import LanguageToggle from './components/LanguageToggle'
import { useAppStore } from './store/useAppStore'

export default function App() {
  const view = useAppStore(s => s.view)
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapView />

      {view === 'entry' && (
        <>
          {/* Entry wash — a faint water-toned veil over the canvas (spec §12.0) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-subtle-cool/60 to-transparent"
          />
          <EntryCard />
          <CoverageKey />
        </>
      )}

      {view === 'searched' && (
        <>
          {/* Desktop panel (md+) and mobile bottom sheet (<md) share PanelBody */}
          <WorkspacePanel />
          <MobileSheet />
          <LayerTray />
          <Legend />
        </>
      )}

      <div className="absolute left-4 top-4 z-10">
        <LanguageToggle />
      </div>
    </div>
  )
}
