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

  it('an empty reservoir result blames the missing record, not the source', () => {
    const s = resultSummary('reservoirs', { status: 'unavailable' }, t)
    expect(s).toMatch(/no supply-system record/i)
    expect(s).not.toMatch(/could not be reached|no current result/i)
  })

  it('in-zone flood names the return period', () => {
    const s = resultSummary('flood', { status: 'available', data: { inZone: true, returnPeriod: '100', source: 'SNCZI' } }, t)
    expect(s).toMatch(/T100/)
  })

  it('shows the exact date of the most recent mapped fire, not only its year', () => {
    const s = resultSummary('fireHistory', {
      status: 'available',
      data: {
        fires: [
          { date: '2026-07-29', areaHa: 318, distanceKm: 12 },
          { date: '2025-06-01', areaHa: 20, distanceKm: 8 },
        ],
        radiusKm: 30,
        since: 2012,
        source: 'Copernicus EFFIS',
      },
    }, t)
    expect(s).toContain('29 July 2026')
  })

  it('distinguishes recent thermal detections from confirmed active fires', () => {
    const s = resultSummary('activeFire', {
      status: 'available',
      data: {
        detections: [{
          id: 'n20-1', detectedAt: '2026-08-03T11:42:00Z',
          lat: 44.84, lng: -0.58, distanceKm: 4.2,
          confidence: 'nominal', satellite: 'NOAA-20',
        }],
        radiusKm: 30,
        windowHours: 24,
        through: '2026-08-03T12:00:00Z',
        source: 'NASA FIRMS',
      },
    }, t)
    expect(s).toMatch(/1 thermal detection/i)
    expect(s).toContain('3 August 2026')
    expect(s).not.toMatch(/1 active fire/i)
  })
})
