import { describe, it, expect } from 'vitest'
import { DATASETS, orderedDatasets, getDataset } from './datasets'
import { ALL_DATASET_IDS } from '../types/workspace'
import en from '../i18n/en.json'
import es from '../i18n/es.json'
import type { SearchResult } from '../types'

const sevilla: SearchResult = {
  displayName: 'Sevilla, Andalucía, España',
  coordinates: { lat: 37.39, lng: -5.98 },
  municipality: 'Sevilla', countryCode: 'es', provinceName: 'Sevilla', basin: { id: 'ES050', name: 'Guadalquivir' },
}
const cordoba: SearchResult = { ...sevilla, municipality: 'Córdoba', countryCode: 'es', provinceName: 'Córdoba' }

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

  it('audience reorders emphasis without changing membership', () => {
    const neutral = orderedDatasets(sevilla, null).map(d => d.id)
    const buyer = orderedDatasets(sevilla, 'buyer_investor').map(d => d.id)
    const resident = orderedDatasets(sevilla, 'resident_owner').map(d => d.id)
    expect([...buyer].sort()).toEqual([...neutral].sort())
    expect(neutral.length).toBe(DATASETS.length)
    expect(buyer[0]).toBe('flood')
    expect(resident[0]).toBe('drought')
  })

  it('map roles: four primaries, reservoirs is context, waterQuality and bathingWater are panel-only', () => {
    expect(DATASETS.filter(d => d.mapRole === 'primary').map(d => d.id).sort())
      .toEqual(['coastalFlood', 'drought', 'flood', 'groundwater'])
    expect(getDataset('reservoirs').mapRole).toBe('context')
    expect(getDataset('waterQuality').mapRole).toBe('none')
    expect(getDataset('bathingWater').mapRole).toBe('none')
  })
})
