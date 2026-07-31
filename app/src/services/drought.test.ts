import { describe, it, expect, vi, afterEach } from 'vitest'

const COORDS = { lat: 36.51, lng: -4.89 }

vi.mock('./wmsSample', async importOriginal => {
  const actual = await importOriginal<typeof import('./wmsSample')>()
  return { ...actual, samplePixel: vi.fn(), anyPixelPainted: vi.fn() }
})

const { samplePixel, anyPixelPainted } = await import('./wmsSample')
const { getDroughtStatus, resetSliceCache } = await import('./drought')
const pixel = vi.mocked(samplePixel)
const painted = vi.mocked(anyPixelPainted)

const CLEAR = { r: 0, g: 0, b: 0, a: 0 }
const WATCH = { r: 240, g: 228, b: 66, a: 255 }
const WARNING = { r: 230, g: 159, b: 0, a: 255 }
const ALERT = { r: 220, g: 5, b: 12, a: 255 }

afterEach(() => {
  vi.resetAllMocks()
  resetSliceCache()
  vi.unstubAllGlobals()
})

/** The slice probe and capabilities lookup both go through fetch. */
function stubSliceFetch() {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })))
}

describe('getDroughtStatus', () => {
  it('classifies each painted CDI colour', async () => {
    stubSliceFetch()
    for (const [px, level] of [[WATCH, 'watch'], [WARNING, 'warning'], [ALERT, 'alert']] as const) {
      pixel.mockResolvedValue(px)
      await expect(getDroughtStatus(COORDS)).resolves.toMatchObject({ level })
    }
  })

  it('reads an unpainted pixel as "no drought" when the layer is rendering', async () => {
    // The CDI paints only Watch, Warning and Alert, so an unpainted land pixel
    // means conditions are below the Watch threshold. Reporting that as
    // unknown is what made most of Andalucía show "no data" on a live feed.
    stubSliceFetch()
    pixel.mockResolvedValue(CLEAR)
    painted.mockResolvedValue(true)
    await expect(getDroughtStatus(COORDS)).resolves.toMatchObject({ level: 'none' })
  })

  it('will not call an unpainted pixel "no drought" when the layer draws nothing', async () => {
    // An empty raster from a broken service is indistinguishable at one pixel
    // from a correct "nothing here", and "no drought" is the reading a user
    // would most want to trust — so it needs the layer proven live first.
    stubSliceFetch()
    pixel.mockResolvedValue(CLEAR)
    painted.mockResolvedValue(false)
    await expect(getDroughtStatus(COORDS)).resolves.toMatchObject({ level: 'unknown' })
  })

  it('falls back to unknown when the sentinel itself fails', async () => {
    stubSliceFetch()
    pixel.mockResolvedValue(CLEAR)
    painted.mockRejectedValue(new Error('WMS 502'))
    await expect(getDroughtStatus(COORDS)).resolves.toMatchObject({ level: 'unknown' })
  })

  it('checks liveness once per session, not once per lookup', async () => {
    stubSliceFetch()
    pixel.mockResolvedValue(CLEAR)
    painted.mockResolvedValue(true)
    await getDroughtStatus(COORDS)
    await getDroughtStatus({ lat: 37.39, lng: -5.98 })
    expect(painted).toHaveBeenCalledTimes(1)
  })

  it('returns unknown when the point sample throws', async () => {
    stubSliceFetch()
    pixel.mockRejectedValue(new Error('WMS 500'))
    await expect(getDroughtStatus(COORDS)).resolves.toMatchObject({ level: 'unknown' })
  })
})
