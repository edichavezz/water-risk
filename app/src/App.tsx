import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import MapView from './components/Map/MapView'
import SearchBar from './components/Search/SearchBar'
import RiskPanel from './components/RiskPanel/RiskPanel'
import LayerToggle from './components/LayerToggle'
import LanguageToggle from './components/LanguageToggle'

export default function App() {
  const { t } = useTranslation()
  const [panelOpen, setPanelOpen] = useState(true)

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-100">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm z-20 flex-wrap">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl">💧</span>
          <div>
            <span className="font-bold text-blue-700 text-sm">{t('appName')}</span>
            <span className="text-gray-400 text-xs ml-1.5 hidden sm:inline">{t('tagline')}</span>
          </div>
        </div>

        {/* Search — grows to fill space */}
        <div className="flex-1 min-w-[200px] max-w-xl">
          <SearchBar />
        </div>

        {/* Layer toggles */}
        <div className="hidden md:flex items-center">
          <LayerToggle />
        </div>

        {/* Language + panel toggle */}
        <div className="flex items-center gap-2 ml-auto">
          <LanguageToggle />
          <button
            onClick={() => setPanelOpen(o => !o)}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 lg:hidden"
            title="Toggle panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar panel */}
        <aside
          className={`
            flex flex-col w-80 shrink-0 bg-white border-r border-gray-200 z-10 overflow-hidden
            transition-all duration-200
            ${panelOpen ? 'translate-x-0' : '-translate-x-full absolute inset-y-0 left-0'}
            lg:translate-x-0 lg:relative
          `}
        >
          <RiskPanel />
        </aside>

        {/* Map */}
        <main className="flex-1 relative overflow-hidden">
          <MapView />

          {/* Mobile layer toggle overlay */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex md:hidden z-10">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 px-3 py-2">
              <LayerToggle />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
