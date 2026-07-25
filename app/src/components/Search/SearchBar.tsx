import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { geocodeAddress } from '../../services/geocoding'
import { useAppStore } from '../../store/useAppStore'
import { getFloodZoneStatus } from '../../services/floodZone'
import { getDroughtStatus } from '../../services/drought'
import { getNearbyReservoirs } from '../../services/reservoirs'
import { generateRiskSummary, generateQuestions } from '../../services/ai'
import { getWaterQualityByMunicipality } from '../../services/waterQuality'
import { getCoastalFloodStatus, isCoastalProvincia } from '../../services/coastalFlood'
import { getGroundwaterStatus } from '../../services/groundwater'
import { getNearestBathingSite } from '../../services/bathingWater'
import type { SearchResult } from '../../types'

export default function SearchBar() {
  const { t } = useTranslation()
  const { language, userType, setProfile, updateProfile } = useAppStore()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleInput = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 3) { setSuggestions([]); setOpen(false); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await geocodeAddress(value)
        setSuggestions(results)
        setOpen(results.length > 0)
      } catch {
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 350)
  }

  const handleSelect = async (result: SearchResult) => {
    setQuery(result.municipio || result.displayName.split(',')[0])
    setOpen(false)
    setSuggestions([])

    // Initialise profile with loading state
    setProfile({
      location: result,
      floodZone: null,
      drought: null,
      reservoirs: [],
      waterQuality: null,
      coastalFlood: null,
      groundwater: null,
      bathingWater: null,
      loading: true,
    })

    const coastal = isCoastalProvincia(result.provincia, result.displayName)

    const [floodZone, drought, coastalFlood, waterQuality] = await Promise.all([
      getFloodZoneStatus(result.coordinates).catch(() => null),
      getDroughtStatus(result.coordinates).catch(() => null),
      coastal ? getCoastalFloodStatus(result.coordinates).catch(() => null) : Promise.resolve(null),
      getWaterQualityByMunicipality(result.municipio ?? '').catch(() => null),
    ])
    const reservoirs = getNearbyReservoirs(result.coordinates)
    const groundwater = getGroundwaterStatus(result.coordinates)
    const bathingWater = await getNearestBathingSite(result.coordinates).catch(() => null)

    updateProfile({
      floodZone, drought, reservoirs, waterQuality, coastalFlood, groundwater, bathingWater, loading: false,
    })

    const profileSnap = {
      location: result,
      floodZone,
      drought,
      reservoirs,
      waterQuality,
      coastalFlood,
      groundwater,
      bathingWater,
      loading: false,
    }

    generateRiskSummary(profileSnap, userType, language)
      .then(aiSummary => updateProfile({ aiSummary }))
      .catch(() => {})

    generateQuestions(profileSnap, userType, language)
      .then(aiQuestions => updateProfile({ aiQuestions }))
      .catch(() => {})
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && suggestions.length > 0) handleSelect(suggestions[0])
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={t('search.placeholder')}
          className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400 min-w-0"
          autoComplete="off"
        />
        {searching && (
          <svg className="w-4 h-4 text-blue-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                onClick={() => handleSelect(s)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0"
              >
                <span className="font-medium text-gray-800">
                  {s.municipio || s.displayName.split(',')[0]}
                </span>
                {s.provincia && (
                  <span className="text-gray-500 ml-1">· {s.provincia}</span>
                )}
                <div className="text-xs text-gray-400 truncate">{s.displayName}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
