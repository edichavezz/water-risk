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
      municipality: 'Alcalá de Guadaíra', countryCode: 'es',
      provinceName: 'Sevilla',
    }
    const result = getReservoirsForLocation(location)
    expect(result.length).toBe(7)
    expect(result.every(r => r.systemName === 'EMASESA')).toBe(true)
    const names = result.map(r => r.name.toUpperCase())
    for (const expected of ['ARACENA', 'ZUFRE', 'LA MINILLA', 'GERGAL', 'MELONARES', 'CALA', 'EL PINTADO']) {
      expect(names.some(n => n.includes(expected))).toBe(true)
    }
  })

  // No proximity fallback: a reservoir near a town may serve irrigation and
  // supply nobody, so nearness must never stand in for a supply record.
  it('returns nothing when the municipality has no supply-system record', () => {
    const location: SearchResult = {
      displayName: 'Somewhere unmapped, Spain',
      coordinates: { lat: 37.338, lng: -5.847 }, // well within 80 km of the EMASESA reservoirs
      municipality: 'Not A Real Mapped Town',
      provinceName: 'Sevilla',
    }
    expect(getReservoirsForLocation(location)).toEqual([])
  })

  it('returns nothing when municipio is missing entirely', () => {
    const location: SearchResult = { displayName: 'Unknown', coordinates: { lat: 37.338, lng: -5.847 } }
    expect(getReservoirsForLocation(location)).toEqual([])
  })

  it('every returned reservoir names the system it was matched through', () => {
    const location: SearchResult = {
      displayName: 'Córdoba, Spain',
      coordinates: { lat: 37.8882, lng: -4.7794 },
      municipality: 'Córdoba', countryCode: 'es',
      provinceName: 'Córdoba',
    }
    const result = getReservoirsForLocation(location)
    expect(result.length).toBeGreaterThan(0)
    expect(result.every(r => r.systemName !== undefined)).toBe(true)
  })

  it('reproduces the real Nominatim response shape for postcode 41500 and still matches EMASESA', () => {
    // Real Nominatim address block for q=41500, verified live 2026-07-24:
    // https://nominatim.openstreetmap.org/search?q=41500&format=json&countrycodes=es&addressdetails=1
    const nominatimAddress = {
      town: 'Alcalá de Guadaíra',
      province: 'Sevilla',
      state: 'Andalucía',
    }
    // Same field-picking order as geocoding.ts's geocodeAddress()
    const municipio =
      (nominatimAddress as any).city ||
      (nominatimAddress as any).town ||
      (nominatimAddress as any).village ||
      (nominatimAddress as any).municipality ||
      ''

    const location: SearchResult = {
      displayName: '41500, Alcalá de Guadaíra, Sevilla, Andalucía, España',
      coordinates: { lat: 37.3433569, lng: -5.8402153 },
      municipality: municipio,
    }
    const result = getReservoirsForLocation(location)
    expect(result.length).toBe(7)
    expect(result.every(r => r.systemName === 'EMASESA')).toBe(true)
  })
})
