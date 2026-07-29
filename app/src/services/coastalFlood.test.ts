import { describe, it, expect } from 'vitest'
import { isCoastalProvincia } from './coastalFlood'

// Nominatim's address.county is unreliable: for some coastal municipalities it
// returns a comarca or tourism region instead of the province, so the province
// name only appears deeper in displayName. These cases pin that second signal.
describe('isCoastalProvincia', () => {
  it('matches on displayName when provincia is a comarca', () => {
    expect(
      isCoastalProvincia(
        'Costa del Sol Occidental',
        'Marbella, Costa del Sol Occidental, Málaga, Andalucía, España',
      ),
    ).toBe(true)
  })

  it('matches on provincia alone when it is the real province', () => {
    expect(isCoastalProvincia('Málaga')).toBe(true)
  })

  it('stays false for an inland address', () => {
    expect(isCoastalProvincia('Córdoba', 'Córdoba, Andalucía, España')).toBe(false)
  })

  it('stays false when neither signal is present', () => {
    expect(isCoastalProvincia(undefined, undefined)).toBe(false)
  })
})
