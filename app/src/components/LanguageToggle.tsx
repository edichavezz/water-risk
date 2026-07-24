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
    <div className="flex items-center gap-0 rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
      {(['en', 'es'] as Language[]).map(lang => (
        <button
          key={lang}
          onClick={() => toggle(lang)}
          className={`px-2.5 py-1 uppercase transition-colors ${
            language === lang
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          {lang}
        </button>
      ))}
    </div>
  )
}
