import { useEffect, useId, useRef } from 'react'
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
  const searchFocusNonce = useAppStore(s => s.searchFocusNonce)
  const input = useRef<HTMLInputElement>(null)
  const { query, setQuery, suggestions, searching, failed, onInput, clear } = useLocationSearch()

  // The About page's call to action asks for the cursor here, so "try it out"
  // lands the reader on the map ready to type rather than merely looking at it.
  useEffect(() => {
    if (searchFocusNonce > 0) input.current?.focus()
  }, [searchFocusNonce])

  const choose = (result: SearchResult) => {
    setQuery(result.municipio || result.displayName.split(',')[0])
    clear()
    void submitLocation(result)
  }

  const toggleAudience = (a: Audience) => setAudience(audience === a ? null : a)

  return (
    /* Docked left and sized to its content — never stretched to full height,
       so the map stays readable behind and beside it. */
    <div className="absolute left-8 top-[88px] z-10 max-h-[calc(100dvh-7.5rem)] w-[360px] max-w-[calc(100vw-4rem)] overflow-y-auto rounded-2xl bg-canvas p-6 shadow-[0_10px_28px_rgba(30,42,56,.16)]">
      {/* The heading this card used to carry is now the header tagline. */}
      <p className="text-[13px] leading-relaxed text-muted">{t('entry.supporting')}</p>

      <div className="relative mt-4">
        <label htmlFor={inputId} className="mb-1.5 block text-xs font-bold text-ink">
          {t('entry.locationLabel')}
        </label>
        <input
          id={inputId}
          ref={input}
          type="text"
          value={query}
          autoComplete="off"
          onChange={e => onInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && suggestions.length > 0) choose(suggestions[0]) }}
          className="min-h-11 w-full rounded-[10px] border border-field bg-canvas px-3 py-2 text-sm outline-none focus:border-primary"
        />
        {searching && <span className="absolute right-3 top-10 text-xs text-muted">…</span>}
        {suggestions.length > 0 && (
          <ul role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-[10px] border border-hairline bg-canvas shadow-[0_10px_28px_rgba(30,42,56,.16)]">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  role="option"
                  aria-selected={false}
                  onClick={() => choose(s)}
                  className="block min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-subtle-cool"
                >
                  <span className="font-bold text-ink">{s.municipio || s.displayName.split(',')[0]}</span>
                  {s.provincia && <span className="text-muted"> · {s.provincia}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {failed && <p className="mt-1.5 text-[13px] text-danger">{t('entry.noResults')}</p>}
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-ink">{t('entry.audiencePrompt')}</span>
          <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-ink">
            {t('entry.optional')}
          </span>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {(['resident_owner', 'buyer_investor'] as Audience[]).map(a => (
            <button
              key={a}
              type="button"
              aria-pressed={audience === a}
              onClick={() => toggleAudience(a)}
              /* Selected reads as a deliberate 1.5px teal outline over the cool
                 wash, rather than a heavier filled state. */
              className={`min-h-11 rounded-[10px] px-3 py-2 text-left text-[13px] text-ink ${
                audience === a
                  ? 'border-[1.5px] border-primary bg-primary-soft'
                  : 'border border-field bg-canvas hover:bg-subtle-cool'
              }`}
            >
              {t(a === 'resident_owner' ? 'entry.resident' : 'entry.buyer')}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-micro">{t('entry.changeLater')}</p>
      </div>

      <button
        type="button"
        disabled={suggestions.length === 0}
        onClick={() => suggestions.length > 0 && choose(suggestions[0])}
        className="mt-4 min-h-11 w-full rounded-[10px] bg-primary py-2 text-[13px] font-bold text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {t('entry.submit')}
      </button>
      <p className="mt-2.5 text-center text-[11px] text-micro">{t('entry.exploreHint')}</p>
    </div>
  )
}
