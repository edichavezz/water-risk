import i18n from './index'

// Regional variants, so dates read the way they do in the countries the app
// answers for. English is the day-first en-GB form rather than the US default,
// because the reader is looking at Mediterranean data, not American data.
const LOCALES: Record<string, string> = {
  en: 'en-GB',
  es: 'es-ES',
  fr: 'fr-FR',
  it: 'it-IT',
  el: 'el-GR',
  ar: 'ar',
}

/**
 * The BCP 47 tag to format with.
 *
 * `-u-nu-latn` pins Latin digits. It is a no-op for the five European bundles
 * and deliberate for Arabic: `toLocaleString('ar')` renders Arabic-Indic
 * numerals (٣٤٫٥), which are correct Arabic but do not match the figures on the
 * official source pages a reader checks these readings against, nor the digits
 * on the map's own scale bar. Words get translated; measurements do not.
 */
export function localeFor(lang = i18n.language): string {
  return `${LOCALES[lang] ?? lang}-u-nu-latn`
}

// Long-form date for source "as of" statements. Falls back to the raw string
// so an unparseable upstream date is shown verbatim rather than as "Invalid Date".
export function formatLongDate(iso: string, lang = i18n.language): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(localeFor(lang), {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

/** Measurements — reservoir volumes, hectares. See localeFor on digits. */
export function formatMeasurement(
  value: number,
  lang = i18n.language,
  options: Intl.NumberFormatOptions = {},
): string {
  return value.toLocaleString(localeFor(lang), options)
}
