import { describe, it, expect, vi, afterEach } from 'vitest'
import { getFloodZoneStatus } from './floodZone'

const COORDS = { lat: 37.39, lng: -5.98 }

/**
 * `getFloodZoneStatus` reads rendered pixels, so these stub `samplePixel`
 * rather than fetch — the decoding is not what is under test, the decision
 * made from three readings is.
 */
vi.mock('./wmsSample', async importOriginal => {
  const actual = await importOriginal<typeof import('./wmsSample')>()
  return { ...actual, samplePixel: vi.fn() }
})
const { samplePixel } = await import('./wmsSample')
const mocked = vi.mocked(samplePixel)

const CLEAR = { r: 0, g: 0, b: 0, a: 0 }
const PAINTED = { r: 5, g: 38, b: 218, a: 255 }

afterEach(() => vi.resetAllMocks())

describe('getFloodZoneStatus', () => {
  it('reports the worst period covering the point', async () => {
    // T10 is sampled first, so a hit there is the answer.
    mocked.mockResolvedValue(PAINTED)
    await expect(getFloodZoneStatus(COORDS)).resolves.toMatchObject({
      inZone: true,
      returnPeriod: '10',
    })
  })

  it('reports out-of-zone only when all three periods answered', async () => {
    mocked.mockResolvedValue(CLEAR)
    await expect(getFloodZoneStatus(COORDS)).resolves.toMatchObject({ inZone: false })
    expect(mocked).toHaveBeenCalledTimes(3)
  })

  it('throws rather than clearing the point when a period fails to answer', async () => {
    // The dangerous case: the narrowest zone says "not painted" and the two
    // wider ones — the zones most likely to contain the point — never
    // answered. Returning inZone: false here would be an all-clear derived
    // from a third of the evidence.
    mocked
      .mockResolvedValueOnce(CLEAR)
      .mockRejectedValueOnce(new Error('WMS 500'))
      .mockRejectedValueOnce(new Error('WMS 500'))
    await expect(getFloodZoneStatus(COORDS)).rejects.toThrow('WMS 500')
  })

  it('throws when the service is down entirely', async () => {
    mocked.mockRejectedValue(new Error('WMS 503'))
    await expect(getFloodZoneStatus(COORDS)).rejects.toThrow('WMS 503')
  })

  it('still answers in-zone when a later period is broken', async () => {
    // A hit on T10 needs no other layer, so one broken period must not stop a
    // positive finding that is already established.
    mocked.mockResolvedValueOnce(PAINTED).mockRejectedValue(new Error('WMS 500'))
    await expect(getFloodZoneStatus(COORDS)).resolves.toMatchObject({ inZone: true })
  })
})
