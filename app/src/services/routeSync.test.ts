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

  it('opens the About page from a link that carries no location', async () => {
    await applyRouteToStore({ page: 'about' })
    expect(useAppStore.getState().page).toBe('about')
  })

  it('restores the search behind an About link, so going back keeps it', async () => {
    vi.mocked(geocoding.reverseGeocode).mockResolvedValue({
      displayName: 'Sevilla', coordinates: { lat: 37.39, lng: -5.98 }, municipio: 'Sevilla',
    })
    await applyRouteToStore({ page: 'about', lat: 37.39, lng: -5.98 })
    const s = useAppStore.getState()
    expect(s.page).toBe('about')
    expect(s.view).toBe('searched')
    expect(s.location?.municipio).toBe('Sevilla')
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
