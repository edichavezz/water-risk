import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LanguageToggle from '../LanguageToggle'
import AboutDialog from './AboutDialog'
import { APP_NAME } from './identity'

export default function AppHeader() {
  const { t } = useTranslation()
  const [aboutOpen, setAboutOpen] = useState(false)
  const aboutButton = useRef<HTMLButtonElement>(null)

  // Send focus back to the trigger on close, so keyboard users resume where
  // they left off instead of at the top of the document.
  const closeAbout = () => {
    setAboutOpen(false)
    aboutButton.current?.focus()
  }

  return (
    <header className="absolute inset-x-0 top-0 z-30 flex min-h-14 items-center gap-3 border-b border-gray-200 bg-canvas/95 px-4 py-2">
      <div className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2">
        <h1 className="text-sm font-bold leading-tight text-ink sm:text-base">{APP_NAME}</h1>
        <p className="text-[11px] leading-tight text-muted sm:text-xs">{t('app.tagline')}</p>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          ref={aboutButton}
          type="button"
          onClick={() => setAboutOpen(true)}
          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-ink hover:bg-subtle-cool"
        >
          {t('app.about')}
        </button>
        <LanguageToggle />
      </div>

      {aboutOpen && <AboutDialog onClose={closeAbout} />}
    </header>
  )
}
