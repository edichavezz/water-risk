import i18n from './index'

// Both audiences are reading Spanish data in Spain, so English dates use the
// day-first en-GB form rather than the US default.
const LOCALES: Record<string, string> = { en: 'en-GB', es: 'es-ES' }

// Long-form date for source "as of" statements. Falls back to the raw string
// so an unparseable upstream date is shown verbatim rather than as "Invalid Date".
export function formatLongDate(iso: string, lang = i18n.language): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(LOCALES[lang] ?? lang, {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}
