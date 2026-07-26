import { describe, it, expect } from 'vitest'
import { resultSummary } from './resultSummary'
import i18n from '../../i18n'

const t = i18n.getFixedT('en') as unknown as (k: string, o?: Record<string, unknown>) => string

describe('resultSummary', () => {
  it('states are rendered as explicit state copy, never values', () => {
    expect(resultSummary('flood', { status: 'error' }, t)).toMatch(/could not be reached/i)
    expect(resultSummary('flood', { status: 'unavailable' }, t)).toMatch(/no current result/i)
    expect(resultSummary('flood', { status: 'loading' }, t)).toMatch(/checking/i)
    expect(resultSummary('flood', undefined, t)).toMatch(/checking/i)
  })

  it('available flood result distinguishes finding from conclusion', () => {
    const s = resultSummary('flood', { status: 'available', data: { inZone: false, source: 'SNCZI' } }, t)
    expect(s).toMatch(/outside the mapped/i)
    expect(s).not.toMatch(/\bsafe\b/i)
  })

  it('in-zone flood names the return period', () => {
    const s = resultSummary('flood', { status: 'available', data: { inZone: true, returnPeriod: '100', source: 'SNCZI' } }, t)
    expect(s).toMatch(/T100/)
  })
})
