// @vitest-environment jsdom
// Needs a document: the direction wiring in ./index sets `dir` and `lang` on
// the root element, which the default node environment does not have.
import { describe, expect, it, afterAll } from 'vitest'
import i18n from './index'
import { LANGUAGES, directionFor } from '../types'
import { localeFor, formatMeasurement } from './formatDate'

/**
 * Arabic is the first bundle that changes the shape of the page rather than
 * just its words, so the things that only break in Arabic get their own test:
 * the document direction, and the digits inside a measurement.
 */
describe('document direction', () => {
  afterAll(async () => {
    await i18n.changeLanguage('en')
  })

  it('flips the document to RTL for Arabic and back', async () => {
    await i18n.changeLanguage('ar')
    expect(document.documentElement.dir).toBe('rtl')
    expect(document.documentElement.lang).toBe('ar')

    await i18n.changeLanguage('el')
    expect(document.documentElement.dir).toBe('ltr')
    expect(document.documentElement.lang).toBe('el')
  })

  it.each(LANGUAGES)('%s resolves to a direction', lang => {
    expect(['ltr', 'rtl']).toContain(directionFor(lang))
  })
})

describe('measurements', () => {
  /**
   * The guard on `-u-nu-latn`. Plain `toLocaleString('ar')` renders Arabic-Indic
   * numerals, which are correct Arabic but do not match the figures printed on
   * the official source pages a reader checks these readings against.
   */
  it('keeps Latin digits in Arabic', () => {
    expect(localeFor('ar')).toContain('-u-nu-latn')
    expect(formatMeasurement(1234.5, 'ar', { maximumFractionDigits: 1 })).toMatch(/[0-9]/)
    expect(formatMeasurement(1234.5, 'ar', { maximumFractionDigits: 1 })).not.toMatch(/[٠-٩]/)
  })

  it.each(LANGUAGES)('%s formats a measurement in Latin digits', lang => {
    expect(formatMeasurement(1234.5, lang, { maximumFractionDigits: 1 })).not.toMatch(/[٠-٩]/)
  })
})
