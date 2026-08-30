import { describe, it, expect } from 'vitest'
import { DATASETS, orderedDatasets, getDataset } from './datasets'
import { ALL_DATASET_IDS } from '../types/workspace'
import en from '../i18n/en.json'
import es from '../i18n/es.json'
import type { PlaceContext } from '../types/place'

const sevilla: PlaceContext = {
  displayName: 'Sevilla, Andalucía, España',
  coordinates: { lat: 37.39, lng: -5.98 },
  municipality: 'Sevilla', countryCode: 'es', provinceName: 'Sevilla', basin: { id: 'ES050', name: 'Guadalquivir' },
}
const cordoba: PlaceContext = { ...sevilla, municipality: 'Córdoba', countryCode: 'es', provinceName: 'Córdoba' }

describe('dataset registry', () => {
  it('registers every dataset id exactly once', () => {
    expect(DATASETS.map(d => d.id).sort()).toEqual([...ALL_DATASET_IDS].sort())
  })

  it('has EN and ES labels, cadence, resolution and limitations for every dataset', () => {
    for (const d of DATASETS) {
      for (const dict of [en, es] as any[]) {
        expect(dict.registry[d.id].name, `${d.id} name`).toBeTruthy()
        expect(dict.registry[d.id].cadence).toBeTruthy()
        expect(dict.registry[d.id].resolution).toBeTruthy()
        expect(Array.isArray(dict.registry[d.id].limitations)).toBe(true)
        expect(dict.registry[d.id].limitations.length).toBeGreaterThan(0)
      }
    }
  })

  it('coastal datasets do not apply inland', () => {
    expect(getDataset('coastalFlood').applicability(cordoba)).toBe('not_applicable')
    expect(getDataset('bathingWater').applicability(cordoba)).toBe('not_applicable')
    expect(getDataset('flood').applicability(cordoba)).toBe('covered')
  })

  it('coastal datasets apply when only displayName names the province', () => {
    // Nominatim gives Marbella a comarca ("Costa del Sol Occidental") in place
    // of its province, so no province-name list could ever answer this. The
    // geometric test does not care what Nominatim called the county.
    const marbella: PlaceContext = {
      displayName: 'Marbella, Costa del Sol Occidental, Málaga, Andalucía, España',
      coordinates: { lat: 36.51, lng: -4.88 },
      municipality: 'Marbella', countryCode: 'es',
      provinceName: 'Costa del Sol Occidental',
    }
    expect(getDataset('coastalFlood').applicability(marbella)).toBe('covered')
    expect(getDataset('bathingWater').applicability(marbella)).toBe('covered')
  })

  it('audience reorders emphasis without changing membership', () => {
    const neutral = orderedDatasets(sevilla, null).map(d => d.id)
    const buyer = orderedDatasets(sevilla, 'buyer_investor').map(d => d.id)
    const resident = orderedDatasets(sevilla, 'resident_owner').map(d => d.id)
    expect([...buyer].sort()).toEqual([...neutral].sort())
    expect(neutral.length).toBe(DATASETS.length)
    expect(buyer[0]).toBe('flood')
    expect(resident[0]).toBe('drought')
  })

  it('map roles: four primaries, three context overlays, the rest panel-only', () => {
    expect(DATASETS.filter(d => d.mapRole === 'primary').map(d => d.id).sort())
      .toEqual(['coastalFlood', 'drought', 'fireDanger', 'flood'])
    expect(DATASETS.filter(d => d.mapRole === 'context').map(d => d.id).sort())
      .toEqual(['activeFire', 'fireHistory', 'reservoirs'])
    expect(getDataset('waterQuality').mapRole).toBe('none')
    expect(getDataset('bathingWater').mapRole).toBe('none')
    expect(getDataset('firePrevention').mapRole).toBe('none')
    // Not a primary any more: the polygons it painted were fabricated and the
    // service that publishes the real ones is down.
    expect(getDataset('groundwater').mapRole).toBe('none')
  })

  it('splits into the two hazard families the UI groups by', () => {
    expect(DATASETS.filter(d => d.hazard === 'fire').map(d => d.id).sort())
      .toEqual(['activeFire', 'fireDanger', 'fireHistory', 'firePrevention'])
    expect(DATASETS.every(d => d.hazard === 'water' || d.hazard === 'fire')).toBe(true)
  })

  // A prevention plan's existence says nothing about risk at a point, so there
  // is nothing here for the model to interpret.
  it('keeps the curated prevention links out of AI evidence', () => {
    expect(getDataset('firePrevention').aiAllowed).toBe(false)
  })
})
