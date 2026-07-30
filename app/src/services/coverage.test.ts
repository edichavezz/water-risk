import { describe, it, expect } from 'vitest'
import { coverageProfile, detailedRegionsGeoJSON } from './coverage'
import { DATASETS } from '../registry/datasets'
import type { PlaceContext } from '../types/place'

const place = (
  displayName: string,
  lat: number,
  lng: number,
  countryCode: string,
): PlaceContext => ({
  displayName,
  coordinates: { lat, lng },
  countryCode,
  municipality: displayName.split(',')[0],
})

const sevilla = place('Sevilla, España', 37.38, -5.99, 'es')
const malaga = place('Málaga, España', 36.72, -4.42, 'es')
const badajoz = place('Badajoz, España', 38.88, -6.97, 'es')
const marseille = place('Marseille, France', 43.29, 5.37, 'fr')
const palermo = place('Palermo, Italia', 38.11, 13.36, 'it')
const milano = place('Milano, Italia', 45.46, 9.19, 'it')

describe('coverageProfile', () => {
  it('calls Andalucía detailed', () => {
    for (const p of [sevilla, malaga]) {
      const profile = coverageProfile(p)
      expect(profile.tier).toBe('detailed')
      expect(profile.regionId).toBe('andalucia')
    }
  })

  it('calls the rest of Spain partial', () => {
    expect(coverageProfile(badajoz).tier).toBe('partial')
    expect(coverageProfile(badajoz).regionId).toBeUndefined()
  })

  // The point of the whole refactor. These used to return nothing at all —
  // lookupCoverage said `supported: false` and the app fetched no datasets and
  // refused to interpret.
  it('gives France and Italy a real profile', () => {
    for (const p of [marseille, palermo, milano]) {
      expect(coverageProfile(p).coveredCount).toBeGreaterThan(0)
    }
  })

  it('calls a place with only the Europe-wide layers minimal', () => {
    // Inland Italy: drought, and nothing else — bathing water needs a coast.
    expect(coverageProfile(milano).tier).toBe('minimal')
  })

  // Derived from the registry, so the copy can never quote a number of checks
  // the app does not actually run.
  it('accounts for every registered dataset', () => {
    for (const p of [sevilla, badajoz, marseille, palermo, milano]) {
      const profile = coverageProfile(p)
      expect(profile.totalCount).toBe(DATASETS.length)
      expect(profile.coveredCount).toBe(profile.covered.length)
      expect(profile.covered.filter(id => profile.unsupported.includes(id))).toEqual([])
    }
  })

  it('reports Spain-only sources as unsupported abroad rather than dropping them', () => {
    const profile = coverageProfile(marseille)
    expect(profile.unsupported).toContain('flood')
    expect(profile.covered).toContain('drought')
    expect(profile.covered).toContain('bathingWater')
    // France answers the supply question from its national drinking-water
    // register, so this is covered here even though Spain's curated systems
    // do not reach it.
    expect(profile.covered).toContain('reservoirs')
    expect(profile.covered).toContain('waterRestrictions')
  })
})

describe('detailedRegionsGeoJSON', () => {
  it('returns the regions we hold extra detail for', () => {
    const fc = detailedRegionsGeoJSON()
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features.length).toBe(1)
  })
})
