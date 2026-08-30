import { describe, it, expect } from 'vitest'
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import {
  coverageProfile,
  detailedRegionsGeoJSON,
  nationalCoverageGeoJSON,
  NATIONAL_COUNTRIES,
} from './coverage'
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
const tarifa = place('Tarifa, España', 36.0143, -5.6035, 'es')
const granada = place('Granada, España', 37.18, -3.60, 'es')
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

  it('calls Tarifa detailed, the southernmost town on the mainland', () => {
    // Regression: the 24-point hand-drawn boundary this replaced ran north of
    // Tarifa, so a Cádiz town was told it sat outside the detailed region.
    expect(coverageProfile(tarifa).tier).toBe('detailed')
  })

  it('calls Granada detailed', () => {
    expect(coverageProfile(granada).tier).toBe('detailed')
  })

  it('does not claim groundwater anywhere', () => {
    // Its source data was fabricated and removed, and no live service
    // publishes a replacement — so the coverage box must not promise it.
    for (const p of [sevilla, badajoz, marseille, palermo]) {
      expect(coverageProfile(p).covered).not.toContain('groundwater')
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

describe('nationalCoverageGeoJSON', () => {
  it('paints exactly the countries in NATIONAL_COUNTRIES', () => {
    const fc = nationalCoverageGeoJSON()
    expect(fc.features.map(f => f.properties?.iso).sort()).toEqual(
      [...NATIONAL_COUNTRIES].sort(),
    )
  })

  it('leaves out the overseas territories the app is not framed on', () => {
    const pt = point([-52.3, 4.9]) // Cayenne, French Guiana.
    const hit = nationalCoverageGeoJSON().features.some(f =>
      booleanPointInPolygon(pt, f as GeoJSON.Feature<GeoJSON.MultiPolygon>),
    )
    expect(hit).toBe(false)
  })

  it('covers the mainlands and the islands the registers reach', () => {
    const fc = nationalCoverageGeoJSON()
    const inside = ([lng, lat]: [number, number]) =>
      fc.features.some(f =>
        booleanPointInPolygon(point([lng, lat]), f as GeoJSON.Feature<GeoJSON.MultiPolygon>),
      )
    // Madrid, Palma, Gran Canaria, Paris, Ajaccio.
    for (const c of [
      [-3.7, 40.4], [2.65, 39.57], [-15.43, 28.1], [2.35, 48.86], [8.74, 41.93],
    ] as [number, number][]) {
      expect(inside(c)).toBe(true)
    }
  })
})

/**
 * The house rule in `coverage.ts` is that coverage copy is derived from the
 * registry, never from a hand-kept table. `NATIONAL_COUNTRIES` is the one
 * exception — the map needs a list of shapes to paint — so this probes the
 * registry and fails if the list and the predicates ever disagree.
 *
 * Italy is the case this exists for: the About copy and a registry comment both
 * mention it, but no predicate covers it, so it must not be painted.
 */
describe('NATIONAL_COUNTRIES', () => {
  // One fixed coastal, inhabited point, with only the country code varying.
  // Holding the geometry still is what isolates the country dimension:
  // bathingWater covers any coast and drought covers the continent, so probing
  // real coordinates per country would count those as national sources.
  const PROBE = { lat: 43.29, lng: 5.37 }
  const CANDIDATES = ['es', 'fr', 'it', 'pt', 'gr', 'ma', 'dz', 'hr']

  const verdicts = (code: string) =>
    DATASETS.map(d => d.applicability(place(`Probe, ${code}`, PROBE.lat, PROBE.lng, code)))

  /** Datasets whose answer turns on which country you are in. */
  const nationalDatasets = DATASETS.filter((_, i) =>
    new Set(CANDIDATES.map(c => verdicts(c)[i])).size > 1,
  )

  it('finds the registry actually has country-dependent sources to paint', () => {
    expect(nationalDatasets.length).toBeGreaterThan(0)
  })

  it('lists every country a national source answers in, and no others', () => {
    const answered = CANDIDATES.filter(code =>
      nationalDatasets.some(
        d => d.applicability(place(`Probe, ${code}`, PROBE.lat, PROBE.lng, code)) === 'covered',
      ),
    )

    expect(answered.sort()).toEqual([...NATIONAL_COUNTRIES].sort())
  })
})
