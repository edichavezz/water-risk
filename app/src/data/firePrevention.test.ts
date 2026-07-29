import { describe, it, expect } from 'vitest'
import { getPreventionPlan, PREVENTION_REGIONS } from './firePrevention'
import type { PlaceContext } from '../types/place'

const place = (region?: string): PlaceContext => ({
  displayName: 'X',
  coordinates: { lat: 37, lng: -5 },
  countryCode: 'es',
  region,
})

describe('prevention plans', () => {
  it('matches on the ISO region code, not a place name', () => {
    const plan = getPreventionPlan(place('ES-AN'))
    expect(plan?.planName).toBe('Plan INFOCA')
    expect(plan?.regionName).toBe('Andalucía')
  })

  it('covers regions across all three countries', () => {
    for (const region of ['ES-AN', 'FR-PAC', 'IT-82']) {
      expect(getPreventionPlan(place(region))).not.toBeNull()
    }
  })

  it('returns null rather than a nearby guess when the region is unknown', () => {
    expect(getPreventionPlan(place('ES-EX'))).toBeNull()
    expect(getPreventionPlan(place(undefined))).toBeNull()
  })

  it('keeps the applicability set in step with the table', () => {
    for (const region of PREVENTION_REGIONS) {
      expect(getPreventionPlan(place(region))).not.toBeNull()
    }
  })

  // These are hand-curated government links and they rot. The staleness date is
  // shown to the reader, so it has to be there and has to be a real date.
  it('gives every plan an https link and a checked date', () => {
    for (const region of PREVENTION_REGIONS) {
      const plan = getPreventionPlan(place(region))!
      expect(plan.url).toMatch(/^https:\/\//)
      expect(plan.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(Date.parse(plan.checkedAt))).toBe(false)
      expect(plan.source).toBeTruthy()
    }
  })
})
