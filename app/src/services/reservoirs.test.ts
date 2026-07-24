import { describe, it, expect } from 'vitest'
import { normalizeMunicipio, getReservoirsForLocation } from './reservoirs'
import type { SearchResult } from '../types'

describe('normalizeMunicipio', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeMunicipio('Cádiz')).toBe('cadiz')
    expect(normalizeMunicipio('Alcalá de Guadaíra')).toBe('alcala de guadaira')
    expect(normalizeMunicipio('JAÉN')).toBe('jaen')
  })
})

describe('getReservoirsForLocation', () => {
  it('returns all 7 EMASESA reservoirs for Alcalá de Guadaíra (postcode 41500 area)', () => {
    const location: SearchResult = {
      displayName: 'Alcalá de Guadaíra, Sevilla, Spain',
      coordinates: { lat: 37.338, lng: -5.847 },
      municipio: 'Alcalá de Guadaíra',
      provincia: 'Sevilla',
    }
    const result = getReservoirsForLocation(location)
    expect(result.length).toBe(7)
    expect(result.every(r => r.systemName === 'EMASESA')).toBe(true)
    const names = result.map(r => r.name.toUpperCase())
    for (const expected of ['ARACENA', 'ZUFRE', 'LA MINILLA', 'GERGAL', 'MELONARES', 'CALA', 'EL PINTADO']) {
      expect(names.some(n => n.includes(expected))).toBe(true)
    }
  })

  it('falls back to proximity when no municipality match exists', () => {
    const location: SearchResult = {
      displayName: 'Somewhere unmapped, Spain',
      coordinates: { lat: 37.338, lng: -5.847 },
      municipio: 'Not A Real Mapped Town',
      provincia: 'Sevilla',
    }
    const result = getReservoirsForLocation(location)
    expect(result.length).toBeGreaterThan(0)
    expect(result.every(r => r.systemName === undefined)).toBe(true)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].distanceKm).toBeGreaterThanOrEqual(result[i - 1].distanceKm)
    }
  })

  it('falls back to proximity when municipio is missing entirely', () => {
    const location: SearchResult = { displayName: 'Unknown', coordinates: { lat: 37.338, lng: -5.847 } }
    expect(getReservoirsForLocation(location).length).toBeGreaterThan(0)
  })
})
