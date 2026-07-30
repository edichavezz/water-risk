import { describe, it, expect, vi } from 'vitest'
import {
  parseLatestSlice, stalenessOf, STALE_AFTER_DAYS,
  findServedSlice, MAX_PROBES,
} from './droughtSlice'

// The real cdinx dimension as served on 2026-07-29.
const CAPS = `<WMS_Capabilities>
  <Layer queryable="0">
    <Name>cdinx</Name>
    <Title>Combined Drought Indicator v.4.1</Title>
    <Dimension name="time" units="ISO8601" nearestValue="0">2012-01-01/2024-01-01/P10D</Dimension>
  </Layer>
</WMS_Capabilities>`

describe('parseLatestSlice', () => {
  it('takes the end of an interval dimension', () => {
    expect(parseLatestSlice(CAPS, 'cdinx')).toBe('2024-01-01')
  })

  it('takes the last value of an enumerated dimension', () => {
    const caps = CAPS.replace(
      '2012-01-01/2024-01-01/P10D',
      '2026-06-01,2026-06-11,2026-06-21',
    )
    expect(parseLatestSlice(caps, 'cdinx')).toBe('2026-06-21')
  })

  it('handles a full ISO timestamp', () => {
    const caps = CAPS.replace('2012-01-01/2024-01-01/P10D', '2012-01-01/2025-03-11T00:00:00Z/P10D')
    expect(parseLatestSlice(caps, 'cdinx')).toBe('2025-03-11')
  })

  // Guessing a date here would recreate the bug this replaces.
  it('returns null when the layer has no time dimension', () => {
    expect(parseLatestSlice('<WMS_Capabilities><Layer><Name>cdinx</Name></Layer></WMS_Capabilities>', 'cdinx')).toBeNull()
  })

  it('returns null for a different layer', () => {
    expect(parseLatestSlice(CAPS, 'somethingelse')).toBeNull()
  })

  it('returns null for junk', () => {
    expect(parseLatestSlice('', 'cdinx')).toBeNull()
    expect(parseLatestSlice('<ServiceExceptionReport/>', 'cdinx')).toBeNull()
  })
})

describe('findServedSlice', () => {
  const now = new Date('2026-07-30T00:00:00Z')

  it('returns today when the newest slice is already available', async () => {
    expect(await findServedSlice(async () => true, now)).toBe('2026-07-30')
  })

  it('steps back until the service accepts a slice', async () => {
    // Accept only 2026-06-30, i.e. three 10-day steps back.
    const probe = async (d: string) => d === '2026-06-30'
    expect(await findServedSlice(probe, now)).toBe('2026-06-30')
  })

  it('gives up rather than scanning an abandoned feed forever', async () => {
    const probe = vi.fn(async () => false)
    expect(await findServedSlice(probe, now)).toBeNull()
    expect(probe).toHaveBeenCalledTimes(MAX_PROBES)
  })
})

describe('stalenessOf', () => {
  const today = new Date('2026-07-29T00:00:00Z')

  it('flags a slice older than the threshold as stale', () => {
    const s = stalenessOf('2024-01-01', today)
    expect(s.stale).toBe(true)
    expect(s.ageDays).toBeGreaterThan(900)
  })

  it('does not flag a current slice', () => {
    expect(stalenessOf('2026-07-19', today).stale).toBe(false)
  })

  it('treats an unknown date as unknown, not as fresh', () => {
    const s = stalenessOf(null, today)
    expect(s.stale).toBeNull()
    expect(s.ageDays).toBeNull()
  })

  it('uses a threshold well beyond the 10-day publishing cycle', () => {
    expect(STALE_AFTER_DAYS).toBeGreaterThan(10)
  })
})
