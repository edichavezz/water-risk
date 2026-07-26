import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { useLocationSearch } from './useLocationSearch'
import { submitLocation } from './submitLocation'
import type { SearchResult } from '../../types'
import type { Audience } from '../../types/workspace'

export default function EntryCard() {
  const { t } = useTranslation()
  const inputId = useId()
  const audience = useAppStore(s => s.audience)
  const setAudience = useAppStore(s => s.setAudience)
  const { query, setQuery, suggestions, searching, failed, onInput, clear } = useLocationSearch()

  const choose = (result: SearchResult) => {
    setQuery(result.municipio || result.displayName.split(',')[0])
    clear()
    void submitLocation(result)
  }

  const toggleAudience = (a: Audience) => setAudience(audience === a ? null : a)

  return (
    <div className="absolute left-6 top-1/2 z-10 w-[380px] max-w-[calc(100vw-3rem)] -translate-y-1/2 rounded-2xl bg-canvas p-6 shadow-xl">
      {/* The heading this card used to carry is now the header tagline. */}
      <p className="text-sm text-muted">{t('entry.supporting')}</p>

      <div className="relative mt-4">
        <label htmlFor={inputId} className="mb-1 block text-sm font-bold text-ink">
          {t('entry.locationLabel')}
        </label>
        <input
          id={inputId}
          type="text"
          value={query}
          autoComplete="off"
          onChange={e => onInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && suggestions.length > 0) choose(suggestions[0]) }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
        />
        {searching && <span className="absolute right-3 top-9 text-xs text-muted">…</span>}
        {suggestions.length > 0 && (
          <ul role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-canvas shadow-lg">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  role="option"
                  aria-selected={false}
                  onClick={() => choose(s)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-subtle-cool"
                >
                  <span className="font-bold text-ink">{s.municipio || s.displayName.split(',')[0]}</span>
                  {s.provincia && <span className="text-muted"> · {s.provincia}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {failed && <p className="mt-1 text-sm text-danger">{t('entry.noResults')}</p>}
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-ink">{t('entry.audiencePrompt')}</span>
          <span className="rounded-md bg-subtle-warm px-1.5 py-0.5 text-xs text-muted">{t('entry.optional')}</span>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {(['resident_owner', 'buyer_investor'] as Audience[]).map(a => (
            <button
              key={a}
              type="button"
              aria-pressed={audience === a}
              onClick={() => toggleAudience(a)}
              className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm ${
                audience === a
                  ? 'border-primary bg-primary-soft text-ink'
                  : 'border-gray-300 bg-canvas text-ink hover:bg-subtle-cool'
              }`}
            >
              {t(a === 'resident_owner' ? 'entry.resident' : 'entry.buyer')}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">{t('entry.changeLater')}</p>
      </div>

      <button
        type="button"
        disabled={suggestions.length === 0}
        onClick={() => suggestions.length > 0 && choose(suggestions[0])}
        className="mt-4 min-h-11 w-full rounded-lg bg-primary py-2 font-bold text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {t('entry.submit')}
      </button>
      <p className="mt-2 text-center text-xs text-muted">{t('entry.exploreHint')}</p>
    </div>
  )
}
