import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { LANGUAGES, directionFor, type Language } from '../types'
import en from './en.json'
import es from './es.json'
import fr from './fr.json'
import it from './it.json'
import el from './el.json'
import ar from './ar.json'

export const BUNDLES: Record<Language, Record<string, unknown>> = { en, es, fr, it, el, ar }

/**
 * The name of each language written in that language. A picker that labels
 * Greek as "Greek" is only readable by someone who already reads English —
 * which is exactly the reader it exists to help.
 */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  el: 'Ελληνικά',
  ar: 'العربية',
}

i18n.use(initReactI18next).init({
  resources: Object.fromEntries(
    LANGUAGES.map(lang => [lang, { translation: BUNDLES[lang] }])
  ),
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

/**
 * Direction belongs to the document, not to a component. Arabic has to flip the
 * whole page — the panel's side, scrollbars, every logical padding — and `dir`
 * on the root element is what makes CSS logical properties follow. `lang` moves
 * with it so screen readers switch voice.
 */
function applyDocumentLanguage(lang: string) {
  const root = document.documentElement
  root.lang = lang
  root.dir = directionFor(lang)
}

if (typeof document !== 'undefined') {
  applyDocumentLanguage(i18n.language)
  i18n.on('languageChanged', applyDocumentLanguage)
}

export default i18n
