import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildEvidence, requestInterpretation } from './ai'
import { useAppStore } from '../store/useAppStore'
import type { SearchResult } from '../types'

const sevilla: SearchResult = {
  displayName: 'Sevilla', coordinates: { lat: 37.39, lng: -5.98 },
  municipio: 'Sevilla', provincia: 'Sevilla', basin: 'guadalquivir',
}
const madrid: SearchResult = {
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
