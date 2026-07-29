import { describe, it, expect } from 'vitest'
import { distanceToCoastKm, isCoastal } from './coastline'

describe('isCoastal', () => {
  it.each([
    ['Málaga', 36.72, -4.42],
    ['Cádiz', 36.53, -6.29],
    ['Marseille', 43.29, 5.37],
    ['Palermo', 38.11, 13.36],
    ['Nice', 43.7, 7.27],
    ['Barcelona', 41.39, 2.17],
    ['Napoli', 40.85, 14.27],
  ])('recognises %s as coastal', (_name, lat, lng) => {
    expect(isCoastal({ lat, lng })).toBe(true)
  })

  it.each([
    ['Jaén', 37.77, -3.79],
    ['Córdoba', 37.89, -4.78],
    ['Madrid', 40.42, -3.7],
    ['Toulouse', 43.6, 1.44],
    ['Milano', 45.46, 9.19],
  ])('recognises %s as inland', (_name, lat, lng) => {
    expect(isCoastal({ lat, lng })).toBe(false)
  })

  // The bug this function exists to fix. Seville sits ~80 km up the
  // Guadalquivir, so it is genuinely not coastal — but the province-name list
  // it replaces got there by a different route: Nominatim returns no `county`
  // for Seville, so the province read as "Andalucía" and matched nothing at
  // all, which also hid the datasets in Málaga and Cádiz.
  it('puts Seville inland but its province’s coast within reach', () => {
    expect(isCoastal({ lat: 37.38, lng: -5.99 })).toBe(false)
    expect(isCoastal({ lat: 36.79, lng: -6.35 })).toBe(true) // Sanlúcar, same province
  })

  it('reports Infinity outside the generated box rather than guessing', () => {
    expect(distanceToCoastKm({ lat: -33.9, lng: 151.2 })).toBeGreaterThan(1000)
    expect(isCoastal({ lat: -33.9, lng: 151.2 })).toBe(false)
  })

  it('honours a caller-supplied threshold', () => {
    const sevilla = { lat: 37.38, lng: -5.99 }
    expect(isCoastal(sevilla, 30)).toBe(false)
    expect(isCoastal(sevilla, 120)).toBe(true)
  })
})
