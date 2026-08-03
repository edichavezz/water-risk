import { describe, expect, it, vi } from 'vitest'

vi.mock('../services/activeFires', () => ({
  getRecentFireDetections: vi.fn(async () => { throw new Error('NASA down') }),
}))

import { getDataset } from './datasets'

describe('recent-detection registry failure', () => {
  it('reports an unavailable current observation, never a zero-detection answer', async () => {
    const result = await getDataset('activeFire').fetch({
      displayName: 'Bordeaux', municipality: 'Bordeaux', countryCode: 'fr',
      coordinates: { lat: 44.84, lng: -0.58 },
    })
    expect(result).toEqual({ status: 'unavailable' })
  })
})
