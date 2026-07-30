import MapView from './components/Map/MapView'
import LayerTray from './components/Map/LayerTray'
import EntryCard from './components/Entry/EntryCard'
import CoverageKey from './components/Entry/CoverageKey'
import WorkspacePanel from './components/Panel/WorkspacePanel'
import MobileSheet from './components/Panel/MobileSheet'
import AppHeader from './components/Header/AppHeader'
import AboutPage from './components/About/AboutPage'
import { useAppStore } from './store/useAppStore'

export default function App() {
  const page = useAppStore(s => s.page)
  const view = useAppStore(s => s.view)
  const onMap = page === 'map'

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* The map is mounted for the whole session — never conditionally, and
          never hidden with `display:none`. Unmounting it or collapsing it to
          zero size would throw away the camera, the layers and the active
          search, so About is painted over it instead. */}
      <div className="absolute inset-0" aria-hidden={!onMap} inert={!onMap}>
        <MapView />
      </div>

      {onMap && view === 'entry' && (
        <>
          {/* The entry wash is gone: the basemap itself now carries the warm
              water-toned palette, so a veil on top only muddied it. */}
          <EntryCard />
          <CoverageKey />
        </>
      )}

      {onMap && view === 'searched' && (
        <>
          {/* Desktop panel (md+) and mobile bottom sheet (<md) share PanelBody.
              The legend is no longer separate — it lives inside LayerTray,
              since both describe what is currently drawn on the map. */}
          <WorkspacePanel />
          <MobileSheet />
          <LayerTray />
        </>
      )}

      {!onMap && <AboutPage />}

      <AppHeader />
    </div>
  )
}
