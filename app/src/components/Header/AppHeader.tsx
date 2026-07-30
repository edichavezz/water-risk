import { useTranslation } from 'react-i18next'
import LanguageToggle from '../LanguageToggle'
import { useAppStore } from '../../store/useAppStore'
import { APP_NAME } from './identity'

/* The app mark: a teal droplet-circle with a smaller terracotta one tucked
   into its bottom-right. Drawn in CSS rather than shipped as an asset, so it
   inherits the palette tokens along with everything else. */
function AppMark() {
  return (
    <span aria-hidden className="relative block h-[26px] w-[26px] shrink-0">
      <span className="absolute left-0 top-0 h-5 w-5 rounded-full bg-primary" />
      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-accent" />
    </span>
  )
}

export default function AppHeader() {
  const { t } = useTranslation()
  const page = useAppStore(s => s.page)
  const setPage = useAppStore(s => s.setPage)
  const onAbout = page === 'about'

  return (
    /* No flat bottom border — the 3px teal→terracotta gradient line below the
       bar is the divider. Total height 64px + 3px, which is what MapLibre's
       control offset in index.css clears. */
    <header className="absolute inset-x-0 top-0 z-30 flex h-16 items-center gap-3 bg-canvas px-6 sm:px-8">
      <AppMark />

      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="truncate font-display text-[19px] font-bold leading-none text-ink sm:text-[21px]">
          {APP_NAME}
        </h1>
        <span aria-hidden className="hidden h-5 w-px shrink-0 self-center bg-hairline sm:block" />
        <p className="hidden truncate text-[12.5px] text-muted sm:block">{t('app.tagline')}</p>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2.5">
        {/* One destination at a time: the About pill on the map, a back link
            on About. Either way only `page` moves — the map keeps its camera,
            its layers and any active search. */}
        <nav aria-label={t('app.nav')}>
          <button
            type="button"
            onClick={() => setPage(onAbout ? 'map' : 'about')}
            className={`flex min-h-11 items-center rounded-[20px] border px-4 text-[13px] font-bold ${
              onAbout
                ? 'border-primary text-primary hover:bg-primary-soft'
                : 'border-hairline text-ink hover:bg-subtle-cool'
            }`}
          >
            {onAbout ? (
              <>
                <span aria-hidden>←</span>&nbsp;{t('app.backToMap')}
              </>
            ) : (
              t('app.navAbout')
            )}
          </button>
        </nav>
        <LanguageToggle />
      </div>

      <div
        aria-hidden
        className="absolute inset-x-0 top-16 h-[3px] bg-gradient-to-r from-primary to-accent"
      />
    </header>
  )
}
