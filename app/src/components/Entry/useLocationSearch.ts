import { useRef, useState } from 'react'
import { geocodeAddress } from '../../services/geocoding'
import type { SearchResult } from '../../types'

export function useLocationSearch() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [failed, setFailed] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onInput = (value: string) => {
    setQuery(value)
    setFailed(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 3) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await geocodeAddress(value)
        setSuggestions(results)
        setFailed(results.length === 0)
      } catch {
        setSuggestions([])
        setFailed(true)
      } finally {
        setSearching(false)
      }
    }, 350)
  }

  return { query, setQuery, suggestions, searching, failed, onInput, clear: () => setSuggestions([]) }
}
