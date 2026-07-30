import { describe, it, expect, vi, afterEach } from 'vitest'
import { shapeNetworks, hubeauUdiUrl, forThisCommune, getSupplyForLocation } from './supply'
import { resultSummary } from '../components/Panel/resultSummary'
import type { PlaceContext } from '../types/place'
import type { SupplyProvenance } from '../types/supply'
import en from '../i18n/en.json'

afterEach(() => vi.unstubAllGlobals())

const place = (countryCode: string, municipality: string): PlaceContext => ({
  displayName: municipality,
  coordinates: { lat: 43.3, lng: 5.4 },
  countryCode,
  municipality,
})

describe('shapeNetworks', () => {
  // Hub'Eau returns one row per quartier per year — Marseille alone answers
  // with 209 rows across a decade. Without both filters the reader would see
  // the same network repeatedly, alongside ones that stopped supplying years
  // ago.
  it('keeps only the latest year, deduplicated by network code', () => {
    const rows = [
      { code_reseau: 'A', nom_reseau: 'Vallon d’Ol', annee: '2026' },
      { code_reseau: 'A', nom_reseau: 'Vallon d’Ol', annee: '2026' },
      { code_reseau: 'B', nom_reseau: 'Sainte-Marthe', annee: '2026' },
      { code_reseau: 'C', nom_reseau: 'Retired network', annee: '2019' },
    ]
    expect(shapeNetworks(rows).map(n => n.name)).toEqual(['Sainte-Marthe', 'Vallon d’Ol'])
  })

  it('returns nothing when the register has no rows', () => {
    expect(shapeNetworks([])).toEqual([])
  })
})

describe('forThisCommune', () => {
  const rows = [
    { code_commune: '13055', nom_commune: 'MARSEILLE', code_reseau: 'A', nom_reseau: 'Vallon d’Ol', annee: '2026' },
    { code_commune: '60381', nom_commune: 'MARSEILLE-EN-BEAUVAISIS', code_reseau: 'B', nom_reseau: 'Beauvaisis', annee: '2026' },
    { code_commune: '13201', nom_commune: 'Marseille', code_reseau: 'C', nom_reseau: 'Sainte-Marthe', annee: '2026' },
  ]

  // Hub'Eau matches nom_commune loosely, so "Marseille" also returns
  // Marseille-en-Beauvaisis, 700 km away in the Oise. This is the filter that
  // keeps a reader in Provence from being shown a network in Picardy.
  it('drops communes whose name merely starts the same', () => {
    expect(forThisCommune(rows, 'Marseille').map(r => r.code_reseau)).toEqual(['A', 'C'])
  })

  it('matches regardless of case and accents', () => {
    const accented = [
      { code_commune: '13100', nom_commune: 'SAINT-RÉMY-DE-PROVENCE', code_reseau: 'D', nom_reseau: 'X', annee: '2026' },
    ]
    expect(forThisCommune(accented, 'Saint-Remy-de-Provence')).toHaveLength(1)
  })

  // FR-13 -> INSEE codes beginning 13. Corsica's FR-2A/FR-2B keep their letter,
  // which is how INSEE codes them too.
  it('narrows to the département when the ISO code is known', () => {
    expect(forThisCommune(rows, 'Marseille', 'FR-13').map(r => r.code_reseau)).toEqual(['A', 'C'])
    expect(forThisCommune(rows, 'Marseille', 'FR-60')).toEqual([])
  })
})

describe('hubeauUdiUrl', () => {
  it('queries by commune name and asks for enough rows to find the latest year', () => {
    const url = hubeauUdiUrl('Saint-Rémy-de-Provence')
    expect(url).toContain('nom_commune=Saint-R%C3%A9my-de-Provence')
    expect(url).toContain('size=500')
  })
})

describe('getSupplyForLocation', () => {
  it('gives France a registry-tier answer with networks and no reservoirs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [{
          code_commune: '13055', nom_commune: 'MARSEILLE',
          code_reseau: 'A', nom_reseau: 'MARSEILLE VALLON D’OL', annee: '2026',
        }],
      }),
    })))

    const supply = await getSupplyForLocation(place('fr', 'Marseille'))
    expect(supply.provenance).toBe('official-registry')
    expect(supply.networks).toHaveLength(1)
    // The register has no source-waterbody field; every sample of
    // `nom_installation_amont` came back null. Claiming reservoirs here would
    // be inventing the edge the register does not record.
    expect(supply.reservoirs).toEqual([])
  })

  it('gives Spain the curated tier, naming real reservoirs', async () => {
    const supply = await getSupplyForLocation(place('es', 'Alcalá de Guadaíra'))
    expect(supply.provenance).toBe('curated')
    expect(supply.reservoirs.length).toBeGreaterThan(0)
    expect(supply.systemName).toBe('EMASESA')
  })

  it('says nothing rather than guessing where no tier applies', async () => {
    const supply = await getSupplyForLocation(place('it', 'Palermo'))
    expect(supply.provenance).toBe('none')
    expect(supply.reservoirs).toEqual([])
  })
})

/**
 * The guardrail that makes "never overclaims" mechanical.
 *
 * Each provenance tier knows a different thing, and the wording has to match
 * exactly what its source records. A registry tier borrowing "supplied by these
 * reservoirs" would assert an edge the register does not hold; a basin tier
 * saying "nearby" would reintroduce the proximity claim commit 3f77a57
 * deliberately removed.
 */
describe('supply copy never overclaims', () => {
  const t = (key: string, opts?: Record<string, unknown>) => {
    const value = key.split('.').reduce<unknown>(
      (acc, k) => (acc as Record<string, unknown>)?.[k],
      en as unknown,
    )
    let out = typeof value === 'string' ? value : key
    for (const [k, v] of Object.entries(opts ?? {})) out = out.split(`{{${k}}}`).join(String(v))
    return out
  }

  const FORBIDDEN: Record<SupplyProvenance, RegExp[]> = {
    curated: [],
    // Naming reservoirs to *deny* knowing them is the point of this tier, so
    // the rule bans the affirmative claim rather than the word.
    'official-registry': [/supplied by these/i, /these reservoirs/i, /reservoirs that supply/i],
    // Must not imply proximity or ownership — that is the 3f77a57 rule.
    basin: [/nearby/i, /your reservoirs/i, /\d+\s*km/i, /cercan/i],
    none: [/no reservoirs/i],
  }

  const REQUIRED: Record<SupplyProvenance, RegExp | null> = {
    curated: /hand/i,
    'official-registry': /does not record/i,
    basin: /may or may not/i,
    none: /don’t know|do not know/i,
  }

  for (const tier of Object.keys(FORBIDDEN) as SupplyProvenance[]) {
    const key =
      tier === 'official-registry'
        ? 'supply.officialRegistry'
        : `supply.${tier}`

    it(`the ${tier} tier states its own limits`, () => {
      const copy = t(key, { system: 'EMASESA' })
      expect(copy).not.toBe(key)
      for (const forbidden of FORBIDDEN[tier]) {
        expect(copy, `${tier} copy must not say ${forbidden}`).not.toMatch(forbidden)
      }
      const required = REQUIRED[tier]
      if (required) expect(copy, `${tier} copy must qualify itself`).toMatch(required)
    })
  }

  it('summarises a registry answer without naming reservoirs', () => {
    const summary = resultSummary(
      'reservoirs',
      {
        status: 'available',
        data: {
          provenance: 'official-registry',
          networks: [{ code: 'A', name: 'VALLON D’OL' }],
          reservoirs: [],
          source: { name: "Hub'Eau" },
        },
      },
      t,
    )
    expect(summary).toContain('VALLON D’OL')
    expect(summary).not.toMatch(/reservoir/i)
    expect(summary).not.toMatch(/%/)
  })
})
