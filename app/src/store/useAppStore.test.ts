import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './useAppStore'
import type { PlaceContext } from '../types/place'

const sevilla: PlaceContext = {
  displayName: 'Sevilla', coordinates: { lat: 37.39, lng: -5.98 },
  municipality: 'Sevilla', countryCode: 'es', provinceName: 'Sevilla', basin: { id: 'ES050', name: 'Guadalquivir' },
}
const madrid: PlaceContext = {
  displayName: 'Madrid', coordinates: { lat: 40.42, lng: -3.70 },
  municipality: 'Madrid', countryCode: 'es', provinceName: 'Madrid',
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
})

describe('workspace store', () => {
  it('starts at the entry view with no audience', () => {
    const s = useAppStore.getState()
    expect(s.view).toBe('entry')
    expect(s.audience).toBeNull()
    expect(s.panelMode).toBe('data')
  })

  it('beginSearch moves to searched, computes coverage, resets results', () => {
    useAppStore.getState().setResult('flood', { status: 'available', data: {} })
    useAppStore.getState().beginSearch(sevilla)
    const s = useAppStore.getState()
    expect(s.view).toBe('searched')
    expect(s.coverage?.tier).toBe('detailed')
    expect(s.results).toEqual({})
    expect(s.interpretation.status).toBe('idle')
  })

  it('records where the search came from so the camera can respond', () => {
    useAppStore.getState().beginSearch(sevilla)
    expect(useAppStore.getState().searchOrigin).toBe('query')
    useAppStore.getState().beginSearch(sevilla, 'map')
    expect(useAppStore.getState().searchOrigin).toBe('map')
  })

  // Madrid is outside the detailed region but is still a real place with real
  // results — it must not come back as a dead end.
  it('beginSearch outside the detailed region still profiles the place', () => {
    useAppStore.getState().beginSearch(madrid)
    const c = useAppStore.getState().coverage
    expect(c?.regionId).toBeUndefined()
    expect(c?.coveredCount).toBeGreaterThan(0)
  })

  it('selecting a primary-mapped dataset opens detail and activates its layer', () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().selectDataset('flood')
    const s = useAppStore.getState()
    expect(s.panelDepth).toBe('detail')
    expect(s.selectedDataset).toBe('flood')
    expect(s.primaryLayer).toBe('flood')
  })

  it('primary layers are mutually exclusive', () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().setPrimaryLayer('flood')
    useAppStore.getState().setPrimaryLayer('drought')
    expect(useAppStore.getState().primaryLayer).toBe('drought')
    useAppStore.getState().setPrimaryLayer(null)
    expect(useAppStore.getState().primaryLayer).toBeNull()
  })

  it('rejects a context dataset as primary and vice versa', () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().setPrimaryLayer('reservoirs')
    expect(useAppStore.getState().primaryLayer).toBeNull()
    useAppStore.getState().toggleContextLayer('flood')
    expect(useAppStore.getState().contextLayers).toEqual(['reservoirs'])
  })

  it('caps context overlays and toggles them off', () => {
    useAppStore.getState().beginSearch(sevilla)
    expect(useAppStore.getState().contextLayers).toEqual(['reservoirs'])
    useAppStore.getState().toggleContextLayer('reservoirs')
    expect(useAppStore.getState().contextLayers).toEqual([])
  })

  it('openAiMode switches mode without touching interpretation state', () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().openAiMode()
    const s = useAppStore.getState()
    expect(s.panelMode).toBe('ai')
    expect(s.interpretation.status).toBe('idle')
  })

  it('returning to data mode restores the prior depth', () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().selectDataset('flood')
    useAppStore.getState().openAiMode()
    useAppStore.getState().openDataMode()
    const s = useAppStore.getState()
    expect(s.panelDepth).toBe('detail')
    expect(s.selectedDataset).toBe('flood')
  })

  it('language change marks a ready interpretation stale', () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().setInterpretation({ status: 'ready', text: 'x', scope: { type: 'location' } })
    useAppStore.getState().setLanguage('es')
    expect(useAppStore.getState().interpretation.status).toBe('stale')
    expect(useAppStore.getState().interpretation.staleReason).toBe('language')
  })

  it('audience change marks a ready interpretation stale but keeps the results', () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().setResult('flood', { status: 'available', data: {} })
    useAppStore.getState().setInterpretation({ status: 'ready', text: 'x', scope: { type: 'location' } })
    useAppStore.getState().setAudience('buyer_investor')
    const s = useAppStore.getState()
    expect(s.interpretation.status).toBe('stale')
    expect(s.interpretation.text).toBe('x')
    expect(s.results.flood?.status).toBe('available')
    // The banner names the real reason rather than blaming the language.
    expect(s.interpretation.staleReason).toBe('audience')
  })

  it('audience change leaves a non-ready interpretation alone', () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().setInterpretation({ status: 'loading', scope: { type: 'location' } })
    useAppStore.getState().setAudience('resident_owner')
    expect(useAppStore.getState().interpretation.status).toBe('loading')
  })

  it('goHome returns to entry keeping audience', () => {
    useAppStore.getState().setAudience('buyer_investor')
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().goHome()
    const s = useAppStore.getState()
    expect(s.view).toBe('entry')
    expect(s.audience).toBe('buyer_investor')
    expect(s.location).toBeNull()
  })
})
