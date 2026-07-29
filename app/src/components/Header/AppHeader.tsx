import { useTranslation } from 'react-i18next'
import LanguageToggle from '../LanguageToggle'
import { useAppStore, type Page } from '../../store/useAppStore'
import { APP_NAME } from './identity'

const PAGES: Array<{ id: Page; label: string }> = [
  { id: 'map', label: 'app.navMap' },
  { id: 'about', label: 'app.navAbout' },
]

export default function AppHeader() {
  const { t } = useTranslation()
  const page = useAppStore(s => s.page)
  const setPage = useAppStore(s => s.setPage)

  return (
    <header className="absolute inset-x-0 top-0 z-30 min-h-14 bg-canvas/95">
      <div className="flex min-h-[calc(3.5rem-3px)] items-center gap-3 px-4 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        {/* Decorative: the wordmark beside it already names the app. */}
        <span className="brand-mark" aria-hidden="true">
          <span className="brand-mark__water" />
          <span className="brand-mark__fire" />
        </span>
        <div className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2">
          <h1 className="font-title text-base font-bold leading-tight text-ink sm:text-lg">
            {APP_NAME}
          </h1>
          <p className="text-[11px] leading-tight text-muted sm:text-xs">{t('app.tagline')}</p>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Switching pages only flips `page`: the map, its layers and any
            active search are left exactly as the reader left them. */}
        <nav aria-label={t('app.nav')} className="flex items-center gap-1">
          {PAGES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPage(id)}
              aria-current={page === id ? 'page' : undefined}
              className={`min-h-8 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                page === id
                  ? 'border-primary bg-primary-soft text-ink'
                  : 'border-border text-ink hover:bg-subtle-cool'
              }`}
            >
              {t(label)}
            </button>
          ))}
        </nav>
        <LanguageToggle />
      </div>
      </div>
      {/* Replaces the flat bottom border: the header ends in the two hazard
          colours rather than a hairline. */}
      <div className="brand-rule" aria-hidden="true" />
    </header>
  )
}
