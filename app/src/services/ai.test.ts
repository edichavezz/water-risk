import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildEvidence, requestInterpretation } from './ai'
import { useAppStore } from '../store/useAppStore'
import type { PlaceContext } from '../types/place'

const sevilla: PlaceContext = {
  displayName: 'Sevilla', coordinates: { lat: 37.39, lng: -5.98 },
  municipality: 'Sevilla', countryCode: 'es', provinceName: 'Sevilla', basin: { id: 'ES050', name: 'Guadalquivir' },
}
const madrid: PlaceContext = {
  displayName: 'Madrid', coordinates: { lat: 40.42, lng: -3.70 },
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

describe('buildEvidence', () => {
  it('summarizes available results and passes through non-safe statuses without values', () => {
    const ev = buildEvidence({
      flood: { status: 'available', data: { inZone: false, source: 'SNCZI' } },
      drought: { status: 'error', error: 'timeout' },
    }, 'en')
    const flood = ev.find(e => e.id === 'flood')!
    const drought = ev.find(e => e.id === 'drought')!
    expect(flood.status).toBe('available')
    expect(flood.summary.length).toBeGreaterThan(0)
    expect(drought.status).toBe('error')
    expect(drought.summary).not.toMatch(/low|none|safe/i)
  })

  // Regression: the coastal evidence line used to read the old
  // inServidumbre/inPolicia booleans. Against the zoning shape those are
  // undefined, so it told the model "outside 20 m strip" — a clean bill of
  // health invented from absent fields.
  it('never asserts a coastal in/out verdict the source cannot support', () => {
    const ev = buildEvidence({
      coastalFlood: {
        status: 'available',
        data: {
          zoning: 'Áreas Urbanas e Industriales Consolidadas',
          sensitivity: 'Sensible',
          location: 'Núcleo urbano de Cádiz',
          source: 'REDIAM',
        },
      },
    }, 'en')
    const coastal = ev.find(e => e.id === 'coastalFlood')!
    expect(coastal.summary).toContain('Áreas Urbanas e Industriales Consolidadas')
    expect(coastal.summary).not.toMatch(/outside (the )?(20|100)\s?m/i)
    expect(coastal.summary).not.toMatch(/inside (the )?(20|100)\s?m/i)
    // and it must tell the model the verdict is unavailable
    expect(coastal.summary).toMatch(/not a determination|cannot be answered/i)
  })

  /**
   * Fourth axis of the coverage audit: whatever a dataset resolves to, the
   * thing the model is handed has to say the same thing as the card. These
   * cover each terminal state a dataset can reach.
   */
  it('drops not_applicable datasets instead of describing them as missing', () => {
    // An inland town has no coastal zoning and no bathing site. That is not a
    // gap in our data, so the card is retired — and the model must not be told
    // "no usable value" either, or it will hedge about data nobody expected.
    const ev = buildEvidence({
      coastalFlood: { status: 'not_applicable' },
      bathingWater: { status: 'not_applicable' },
      flood: { status: 'available', data: { inZone: false, source: 'SNCZI' } },
    }, 'en')
    expect(ev.map(e => e.id)).toEqual(['flood'])
  })

  it('hands the model an unavailable dataset as a non-answer, with no source claim', () => {
    // Groundwater is the case this was written for: its evidence line used to
    // assert a negative citing IGME for every point in Spain.
    const ev = buildEvidence({ groundwater: { status: 'unavailable' } }, 'en')
    const g = ev.find(e => e.id === 'groundwater')!
    expect(g.status).toBe('unavailable')
    expect(g.summary).toMatch(/no usable value/i)
    expect(g.summary).not.toMatch(/IGME|overexploited/i)
  })

  it('states a below-threshold drought reading as a finding, not as absent data', () => {
    // The CDI paints only Watch/Warning/Alert, so `none` is a real reading off
    // a layer proven to be rendering. Passed through as the bare word "none"
    // the model reads it as missing and hedges about an answer we have.
    const ev = buildEvidence({
      drought: {
        status: 'available',
        data: { level: 'none', label: 'none', source: 'Copernicus EDO', updatedAt: '2026-07-21' },
      },
    }, 'en')
    const d = ev.find(e => e.id === 'drought')!
    expect(d.summary).toMatch(/below the Watch threshold/i)
    expect(d.summary).toMatch(/2026-07-21/)
    expect(d.summary).not.toMatch(/no data|unknown/i)
  })

  it('carries every dataset state through to the posted prompt unchanged', async () => {
    // Closes the axis end to end: what buildEvidence produces is what the
    // proxy receives, so the card and the summary cannot diverge.
    useAppStore.getState().beginSearch(sevilla)
    const s = useAppStore.getState()
    s.setResult('flood', { status: 'available', data: { inZone: true, returnPeriod: '100', source: 'SNCZI' } })
    s.setResult('groundwater', { status: 'unavailable' })
    s.setResult('coastalFlood', { status: 'not_applicable' })
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ interpretation: 'x', questions: [] }),
    })
    await requestInterpretation({ type: 'location' })

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.evidence).toEqual(buildEvidence(useAppStore.getState().results, 'en'))
    const ids = body.evidence.map((e: { id: string }) => e.id)
    expect(ids).toContain('flood')
    expect(ids).toContain('groundwater')
    expect(ids).not.toContain('coastalFlood')
  })
})

describe('requestInterpretation gating', () => {
  it('never issues a request for an unsupported location', async () => {
    useAppStore.getState().beginSearch(madrid)
    await requestInterpretation({ type: 'location' })
    expect(fetch).not.toHaveBeenCalled()
    expect(useAppStore.getState().interpretation.status).toBe('error')
  })

  it('posts structured evidence and stores the result', async () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().setResult('flood', { status: 'available', data: { inZone: false, source: 'SNCZI' } })
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ interpretation: 'Calm words.', questions: ['q1', 'q2'] }),
    })
    await requestInterpretation({ type: 'dataset', id: 'flood' })
    expect(fetch).toHaveBeenCalledWith('/api/interpret', expect.objectContaining({ method: 'POST' }))
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.scope).toBe('flood')
    expect(body.evidence.length).toBeGreaterThan(0)
    const s = useAppStore.getState().interpretation
    expect(s.status).toBe('ready')
    expect(s.text).toBe('Calm words.')
    expect(s.questions).toEqual(['q1', 'q2'])
  })

  it('sets error state on a failed proxy response', async () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().setResult('flood', { status: 'available', data: { inZone: false, source: 'SNCZI' } })
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 502 })
    await requestInterpretation({ type: 'location' })
    expect(useAppStore.getState().interpretation.status).toBe('error')
  })
})
