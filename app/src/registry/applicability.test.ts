import { describe, it, expect } from 'vitest'
import { DATASETS } from './datasets'
import { isCoastal } from '../services/coastline'
import type { PlaceContext } from '../types/place'

const place = (
  displayName: string,
  lat: number,
  lng: number,
  countryCode: string,
  extra: Partial<PlaceContext> = {},
): PlaceContext => ({
  displayName,
  coordinates: { lat, lng },
  countryCode,
  municipality: displayName.split(',')[0],
  ...extra,
})

const PLACES = [
  place('Sevilla, España', 37.38, -5.99, 'es', { region: 'ES-AN' }),
  place('Málaga, España', 36.72, -4.42, 'es', { region: 'ES-AN' }),
  place('Jaén, España', 37.77, -3.79, 'es', { region: 'ES-AN' }),
  place('Bilbao, España', 43.26, -2.93, 'es', { region: 'ES-PV' }),
  place('Marseille, France', 43.29, 5.37, 'fr', { region: 'FR-PAC' }),
  place('Toulouse, France', 43.6, 1.44, 'fr', { region: 'FR-OCC' }),
  place('Palermo, Italia', 38.11, 13.36, 'it', { region: 'IT-82' }),
  place('Milano, Italia', 45.46, 9.19, 'it', { region: 'IT-25' }),
]

/**
 * The honesty guard.
 *
 * `not_applicable` deletes a row from the list and from the AI's evidence. That
 * is right when the question does not arise (bathing water 200 km inland) and
 * badly wrong when we simply have no source — the row vanishes, the model never
 * sees the gap, and absence reads as absence of risk.
 *
 * Expansion produces overwhelmingly the second kind, so the default must be
 * `unsupported`. This test fails the moment a dataset quietly hides itself
 * outside its home country.
 */
describe('applicability never hides a real gap', () => {
  const COAST_DEPENDENT = new Set(['coastalFlood', 'bathingWater'])

  for (const p of PLACES) {
    for (const d of DATASETS) {
      it(`${d.id} @ ${p.displayName} does not vanish without cause`, () => {
        const verdict = d.applicability(p)
        if (verdict !== 'not_applicable') return

        // Only two excuses are allowed for deleting a row.
        const inland = COAST_DEPENDENT.has(d.id) && !isCoastal(p.coordinates)
        const nothingToLookUp = !p.municipality
        expect(
          inland || nothingToLookUp,
          `${d.id} returned not_applicable at ${p.displayName}. If the reason is ` +
            '"no source covers this here", the correct status is `unsupported` — ' +
            'it stays visible and reaches the AI as an explicit gap.',
        ).toBe(true)
      })
    }
  }

  it('gives every place at least one covered dataset', () => {
    for (const p of PLACES) {
      const covered = DATASETS.filter(d => d.applicability(p) === 'covered')
      expect(covered.length, `${p.displayName} would show an empty panel`).toBeGreaterThan(0)
    }
  })

  // The pan-European layer is what makes "best-effort Mediterranean" true
  // rather than aspirational: without it, France and Italy return nothing.
  it('covers drought everywhere', () => {
    for (const p of PLACES) {
      expect(DATASETS.find(d => d.id === 'drought')!.applicability(p)).toBe('covered')
    }
  })

  it('offers bathing water on French and Italian coasts', () => {
    const bathing = DATASETS.find(d => d.id === 'bathingWater')!
    expect(bathing.applicability(PLACES[4])).toBe('covered') // Marseille
    expect(bathing.applicability(PLACES[6])).toBe('covered') // Palermo
    expect(bathing.applicability(PLACES[5])).toBe('not_applicable') // Toulouse
  })

  it('marks Spain-only sources unsupported abroad, not missing', () => {
    const flood = DATASETS.find(d => d.id === 'flood')!
    expect(flood.applicability(PLACES[0])).toBe('covered')
    expect(flood.applicability(PLACES[4])).toBe('unsupported')
    expect(flood.applicability(PLACES[6])).toBe('unsupported')
  })
})
