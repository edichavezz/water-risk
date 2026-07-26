import MapView from './components/Map/MapView'
import LayerTray from './components/Map/LayerTray'
import Legend from './components/Map/Legend'
import { useAppStore } from './store/useAppStore'

export default function App() {
  const view = useAppStore(s => s.view)
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapView />
      {view === 'searched' && (
        <>
          <LayerTray />
          <Legend />
        </>
      )}
    </div>
  )
}
