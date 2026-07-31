import { describe, it, expect } from 'vitest'
import { getGroundwaterStatus } from './groundwater'
import { getDataset } from '../registry/datasets'
import type { PlaceContext } from '../types/place'

/**
 * This dataset used to answer everywhere off four hand-drawn rectangles, three
 * of them outside Andalucía. The failure mode worth guarding is not the missing
 * card — it is the confident negative: `available` + `inOverexploitedUnit:
 * false`, which the panel rendered as a result and `ai.ts` handed the model as
 * "Not inside a declared overexploited hydrogeological unit (source IGME)" for
 * points where nothing had been checked.
 */
describe('groundwater', () => {
  const points = [
    ['Sevilla', { lat: 37.3891, lng: -5.9845 }],
    ['Níjar — inside the old rectangle', { lat: 36.9662, lng: -2.2064 }],
    ['Órgiva', { lat: 36.9016, lng: -3.4243 }],
    ['Madrid, outside coverage', { lat: 40.4168, lng: -3.7038 }],
  ] as const

  it.each(points)('returns no reading for %s', (_name, coords) => {
    expect(getGroundwaterStatus(coords)).toBeNull()
  })

  it('surfaces as unavailable, never as a clean bill of health', async () => {
    const location: PlaceContext = {
      displayName: 'Sevilla, Andalucía, España',
      coordinates: { lat: 37.3891, lng: -5.9845 },
      countryCode: 'es',
      municipality: 'Sevilla',
    }

    const result = await getDataset('groundwater').fetch(location)
    expect(result.status).toBe('unavailable')
    expect(result.data).toBeUndefined()
  })
})
