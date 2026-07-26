import { describe, it, expect } from 'vitest'
import { SUPPLY_SYSTEMS } from './supplySystems'
import generated from './reservoirs.generated.json'

describe('supply system data integrity', () => {
  it('every reservoirCodEst referenced by a supply system exists in the live feed', () => {
    const knownCodEsts = new Set(generated.reservoirs.map(r => r.codEst))
    for (const system of SUPPLY_SYSTEMS) {
      for (const codEst of system.reservoirCodEsts) {
        expect(knownCodEsts.has(codEst), `${system.id} references unknown cod_est ${codEst}`).toBe(true)
      }
    }
  })

  it('every supply system id is unique', () => {
    const ids = SUPPLY_SYSTEMS.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has at least 20 systems covering all 8 Andalucía provinces', () => {
    expect(SUPPLY_SYSTEMS.length).toBeGreaterThanOrEqual(20)
    const provinces = new Set(SUPPLY_SYSTEMS.map(s => s.province))
    expect(provinces).toEqual(new Set(['Sevilla', 'Málaga', 'Granada', 'Córdoba', 'Cádiz', 'Huelva', 'Almería', 'Jaén']))
  })
})
