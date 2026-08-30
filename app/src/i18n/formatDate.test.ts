import { afterEach, describe, expect, it } from 'vitest'
import { formatLongDate } from './formatDate'

const originalTz = process.env.TZ
afterEach(() => { process.env.TZ = originalTz })

describe('formatLongDate', () => {
  it('keeps an upstream calendar date unchanged west of UTC', () => {
    process.env.TZ = 'America/Los_Angeles'
    expect(formatLongDate('2026-07-29', 'en')).toBe('29 July 2026')
  })
})
