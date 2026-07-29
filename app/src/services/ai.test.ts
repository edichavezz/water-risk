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
