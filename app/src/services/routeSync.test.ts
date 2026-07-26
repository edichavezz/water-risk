// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyRouteToStore } from './routeSync'
import { useAppStore } from '../store/useAppStore'
import * as geocoding from './geocoding'

vi.mock('./geocoding')
vi.mock('./orchestrator', () => ({ runProfile: vi.fn(async () => {}) }))

beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

describe('route -> store', () => {
  it('restores a searched location with audience and dataset', async () => {
    vi.mocked(geocoding.reverseGeocode).mockResolvedValue({
      displayName: 'Sevilla', coordinates: { lat: 37.39, lng: -5.98 },
      municipio: 'Sevilla', provincia: 'Sevilla', basin: 'guadalquivir',
    })
    await applyRouteToStore({ lat: 37.39, lng: -5.98, aud: 'buyer_investor', ds: 'flood', mode: 'data' })
    const s = useAppStore.getState()
    expect(s.view).toBe('searched')
    expect(s.audience).toBe('buyer_investor')
    expect(s.selectedDataset).toBe('flood')
  })

  it('ignores an empty route', async () => {
    await applyRouteToStore({})
    expect(useAppStore.getState().view).toBe('entry')
  })

  it('never lands in AI mode with an auto-generated interpretation', async () => {
    vi.mocked(geocoding.reverseGeocode).mockResolvedValue({
      displayName: 'Sevilla', coordinates: { lat: 37.39, lng: -5.98 }, municipio: 'Sevilla',
    })
    await applyRouteToStore({ lat: 37.39, lng: -5.98, mode: 'ai' })
    const s = useAppStore.getState()
    expect(s.panelMode).toBe('ai')
    expect(s.interpretation.status).toBe('idle')
  })
})
