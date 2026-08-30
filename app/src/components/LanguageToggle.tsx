import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import { LANGUAGES, type Language } from '../types'
import { LANGUAGE_NAMES } from '../i18n'

/* Was a two-button "EN · ES" pill. Six languages do not read as a pill, and a
   row of six codes is a worse tap target than a menu — so this is a native
   <select> wearing the pill's border. Native buys keyboard handling, the
   platform's own long-list behaviour and correct mirroring under RTL for free.
   The visible text is each language's own name: a reader who needs the Greek
   bundle cannot be assumed to recognise the English word "Greek". */
export default function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const { language, setLanguage } = useAppStore()

  const change = (lang: Language) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  return (
    <div className="relative flex min-h-11 items-center rounded-[20px] border border-hairline">
      <select
        aria-label={t('app.language')}
        value={language}
        onChange={e => change(e.target.value as Language)}
        /* `pe-7` clears the chevron on whichever side the text ends — a
           physical `pr-7` would leave it over the first letter in Arabic. */
        className="min-h-11 cursor-pointer appearance-none rounded-[20px] bg-transparent ps-3.5 pe-7 text-[13px] font-bold text-ink"
      >
        {LANGUAGES.map(lang => (
          <option key={lang} value={lang}>
            {LANGUAGE_NAMES[lang]}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute end-3 text-[10px] text-muted">
        ▾
      </span>
    </div>
  )
}
