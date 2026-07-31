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

/**
 * "2 days ago" for a news timestamp, localised by the browser.
 *
 * News is the one place in the app where relative time is the clearer form:
 * the reader is judging freshness, not recording a reading date. Rounded down
 * to whole days, so a headline is never described as newer than it is.
 */
export function relativeDay(epochMs: number, lang = i18n.language, now = Date.now()): string {
  const days = Math.floor((now - epochMs) / 86_400_000)
  const rtf = new Intl.RelativeTimeFormat(LOCALES[lang] ?? lang, { numeric: 'auto' })
  return rtf.format(-days, 'day')
}
