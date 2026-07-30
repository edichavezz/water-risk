import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import type { Language } from '../types'

/* Reads as one pill — "EN · ES" — rather than two boxes, matching the About
   pill beside it. The interpunct is decorative; each half stays a real button. */
export default function LanguageToggle() {
  const { i18n } = useTranslation()
  const { language, setLanguage } = useAppStore()

  const toggle = (lang: Language) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  return (
    <div className="flex min-h-11 items-center rounded-[20px] border border-hairline px-1 text-xs font-bold">
      {(['en', 'es'] as Language[]).map((lang, i) => (
        <Fragment key={lang}>
          {i > 0 && <span aria-hidden className="text-hairline">·</span>}
          <button
            type="button"
            onClick={() => toggle(lang)}
            aria-current={language === lang ? 'true' : undefined}
            className={`rounded-[20px] px-2.5 py-2 uppercase transition-colors duration-[var(--dur-control)] ${
              language === lang ? 'text-primary' : 'text-muted hover:text-ink'
            }`}
          >
            {lang}
          </button>
        </Fragment>
      ))}
    </div>
  )
}
