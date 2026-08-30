import { describe, it, expect, vi, afterEach } from 'vitest'
import { shapeRestrictions, rankLevel, getWaterRestrictions } from './waterRestrictions'

afterEach(() => vi.unstubAllGlobals())

/** Shape captured from a live VigiEau response for Marseille. */
const marseilleZones = [
  {
    nom: 'Littoral', type: 'SUP', departement: '13', niveauGravite: 'vigilance',
    arrete: {
      dateDebutValidite: '2026-07-17',
      dateFinValidite: '2026-10-15',
      cheminFichier: 'https://regleau.example/arrete.pdf',
    },
  },
  { nom: 'Littoral', type: 'SOU', departement: '13', niveauGravite: 'vigilance' },
  { nom: 'Littoral', type: 'AEP', departement: '13', niveauGravite: 'vigilance' },
]

describe('shapeRestrictions', () => {
  it('reads the level, zone, département and decree', () => {
    const r = shapeRestrictions(marseilleZones)!
    expect(r.level).toBe('vigilance')
    expect(r.zoneName).toBe('Littoral')
    expect(r.department).toBe('13')
    expect(r.decreeUrl).toBe('https://regleau.example/arrete.pdf')
    expect(r.validTo).toBe('2026-10-15')
    expect(r.zones).toHaveLength(3)
  })

  // The headline must never average the resources. A decree that puts the
  // drinking-water network into crisis is not softened by rivers being merely
  // under watch — the reader is bound by the strictest rule that applies.
  it('reports the worst level across resources, not a middle one', () => {
    const r = shapeRestrictions([
      { nom: 'Z', type: 'SUP', niveauGravite: 'vigilance' },
      { nom: 'Z', type: 'AEP', niveauGravite: 'crise' },
      { nom: 'Z', type: 'SOU', niveauGravite: 'alerte' },
    ])!
    expect(r.level).toBe('crise')
  })

  it('keeps each resource separately, so the tap and the river can differ', () => {
    const r = shapeRestrictions([
      { nom: 'Z', type: 'SUP', niveauGravite: 'vigilance' },
      { nom: 'Z', type: 'AEP', niveauGravite: 'alerte_renforcee' },
    ])!
    expect(r.zones).toEqual([
      { resource: 'surface', level: 'vigilance', zoneName: 'Z' },
      { resource: 'drinking_water', level: 'alerte_renforcee', zoneName: 'Z' },
    ])
  })

  it('returns null when no zone covers the point', () => {
    expect(shapeRestrictions([])).toBeNull()
  })

  it('ignores zones whose type or level it does not recognise', () => {
    expect(shapeRestrictions([{ nom: 'Z', type: 'XXX', niveauGravite: 'vigilance' }])).toBeNull()
    expect(shapeRestrictions([{ nom: 'Z', type: 'SUP', niveauGravite: 'invented' }])).toBeNull()
  })

  it('orders the four statutory levels weakest first', () => {
    expect(rankLevel('vigilance')).toBeLessThan(rankLevel('alerte'))
    expect(rankLevel('alerte')).toBeLessThan(rankLevel('alerte_renforcee'))
    expect(rankLevel('alerte_renforcee')).toBeLessThan(rankLevel('crise'))
  })
})

describe('getWaterRestrictions', () => {
  it('treats an empty response as "nothing in force", not a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })))
    expect(await getWaterRestrictions({ lat: 43.3, lng: 5.4 })).toBeNull()
  })

  it('throws on a failed request so the row can offer a retry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })))
    await expect(getWaterRestrictions({ lat: 43.3, lng: 5.4 })).rejects.toThrow('503')
  })
})
