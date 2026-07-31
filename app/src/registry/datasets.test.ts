import { describe, it, expect } from 'vitest'
import { DATASETS, orderedDatasets, getDataset } from './datasets'
import { ALL_DATASET_IDS } from '../types/workspace'
import en from '../i18n/en.json'
import es from '../i18n/es.json'
import type { SearchResult } from '../types'

const sevilla: SearchResult = {
  displayName: 'Sevilla, Andalucía, España',
  coordinates: { lat: 37.39, lng: -5.98 },
  municipio: 'Sevilla', provincia: 'Sevilla', basin: 'guadalquivir',
}
const cordoba: SearchResult = { ...sevilla, municipio: 'Córdoba', provincia: 'Córdoba' }

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
    expect(getDataset('coastalFlood').appliesTo(cordoba)).toBe(false)
    expect(getDataset('bathingWater').appliesTo(cordoba)).toBe(false)
    expect(getDataset('flood').appliesTo(cordoba)).toBe(true)
  })

  it('coastal datasets apply when only displayName names the province', () => {
    // Nominatim gives Marbella a comarca ("Costa del Sol Occidental") in place
    // of its province, so provincia alone misses a plainly coastal address.
    // isCoastalProvincia has always accepted displayName as a second signal;
    // appliesTo simply never passed it.
    const marbella: SearchResult = {
      displayName: 'Marbella, Costa del Sol Occidental, Málaga, Andalucía, España',
      coordinates: { lat: 36.51, lng: -4.88 },
      municipio: 'Marbella', provincia: 'Costa del Sol Occidental', basin: 'guadalquivir',
    }
    expect(getDataset('coastalFlood').appliesTo(marbella)).toBe(true)
    expect(getDataset('bathingWater').appliesTo(marbella)).toBe(true)
  })

  it('audience reorders emphasis without changing membership', () => {
    const neutral = orderedDatasets(sevilla, null).map(d => d.id)
    const buyer = orderedDatasets(sevilla, 'buyer_investor').map(d => d.id)
    const resident = orderedDatasets(sevilla, 'resident_owner').map(d => d.id)
    expect([...buyer].sort()).toEqual([...neutral].sort())
    expect(buyer[0]).toBe('flood')
    expect(resident[0]).toBe('drought')
  })

  it('map roles: three primaries, reservoirs is context, the rest are panel-only', () => {
    expect(DATASETS.filter(d => d.mapRole === 'primary').map(d => d.id).sort())
      .toEqual(['coastalFlood', 'drought', 'flood'])
    expect(getDataset('reservoirs').mapRole).toBe('context')
    expect(getDataset('waterQuality').mapRole).toBe('none')
    expect(getDataset('bathingWater').mapRole).toBe('none')
    // Not a primary any more: the polygons it painted were fabricated and the
    // service that publishes the real ones is down.
    expect(getDataset('groundwater').mapRole).toBe('none')
  })
})
