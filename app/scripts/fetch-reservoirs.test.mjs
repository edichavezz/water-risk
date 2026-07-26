import { describe, it, expect } from 'vitest'
import { parseGeom, shapeReservoir } from './fetch-reservoirs.mjs'

describe('parseGeom', () => {
  it('converts EPSG:25830 POINT geometry to lat/lng within known tolerance', () => {
    // E61 Aracena — verified 2026-07-24 against Wikipedia (37.90917, -6.45)
    const { lat, lng } = parseGeom('POINT (196526.95376674 4201216.1089422)')
    expect(lat).toBeGreaterThan(37.85)
    expect(lat).toBeLessThan(37.95)
    expect(lng).toBeGreaterThan(-6.5)
    expect(lng).toBeLessThan(-6.4)
  })

  it('throws on unparseable geometry', () => {
    expect(() => parseGeom('not a point')).toThrow()
  })
})

describe('shapeReservoir', () => {
  it('combines station metadata and today reading into one record', () => {
    const station = { cod_est: 'E61', nombre: 'ARACENA', provincia: 'Huelva ', sistema: 'ABASTECIMIENTO DE SEVILLA', dist_dem: 'GUADALQUIVIR', nombre_rio: 'Rivera de Huelva', geom: 'POINT (196526.95376674 4201216.1089422)' }
    const today = { fecha: '2026-07-24', E61_res: 102.75, E61_cap: 128.65, E61_por: 79.9 }
    const result = shapeReservoir(station, today)
    expect(result).toMatchObject({
      codEst: 'E61',
      name: 'ARACENA',
      province: 'Huelva',
      river: 'Rivera de Huelva',
      basin: 'GUADALQUIVIR',
      fillPercent: 79.9,
      storedHm3: 102.75,
      capacityHm3: 128.65,
    })
    expect(result.lat).toBeCloseTo(37.9, 1)
    expect(result.lng).toBeCloseTo(-6.45, 1)
  })

  it('returns null when there is no fill reading for the station', () => {
    const station = { cod_est: 'X99', nombre: 'GHOST', provincia: 'Test', sistema: 'X', dist_dem: 'X', nombre_rio: 'X', geom: 'POINT (196526.95376674 4201216.1089422)' }
    const today = { fecha: '2026-07-24' }
    expect(shapeReservoir(station, today)).toBeNull()
  })
})
