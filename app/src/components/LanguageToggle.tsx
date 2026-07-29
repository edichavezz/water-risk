import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import type { Language } from '../types'

export default function LanguageToggle() {
  const { i18n } = useTranslation()
  const { language, setLanguage } = useAppStore()

  const toggle = (lang: Language) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  return (
    <div className="flex items-center gap-0 overflow-hidden rounded-lg border border-border text-xs font-semibold">
      {(['en', 'es'] as Language[]).map(lang => (
        <button
          key={lang}
          onClick={() => toggle(lang)}
          className={`min-h-8 px-2.5 py-1 uppercase transition-colors ${
            language === lang
              ? 'bg-primary text-canvas'
              : 'bg-canvas text-muted hover:bg-subtle-cool'
          }`}
        >
          {lang}
        </button>
      ))}
    </div>
  )
}
