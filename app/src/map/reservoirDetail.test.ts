// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { reservoirDetailContent, type ReservoirProps } from './dataLayers'
import { getAllReservoirsGeoJSON } from '../services/reservoirs'
import { formatLongDate } from '../i18n/formatDate'

const props: ReservoirProps = {
  name: 'Tranco De Beas',
  fillPercent: 83.6,
  storedHm3: 422.68,
  capacityHm3: 505.7,
  basin: 'GUADALQUIVIR',
  river: 'Río Guadalquivir',
  province: 'Jaén',
  asOf: '2026-07-24',
}

describe('reservoirDetailContent', () => {
  it('states name, fill, storage and the reading date', () => {
    const text = reservoirDetailContent(props).textContent ?? ''
    expect(text).toContain('Tranco De Beas')
    expect(text).toContain('83.6%')
    expect(text).toContain('422.7')
    expect(text).toContain('505.7')
    expect(text).toContain('Basin: Guadalquivir')
    expect(text).toContain('Level as of 24 July 2026')
  })

  it('omits the storage line when the feed has no volumes', () => {
    const text = reservoirDetailContent({ ...props, storedHm3: null, capacityHm3: null }).textContent ?? ''
    expect(text).not.toContain('hm³')
    expect(text).toContain('Level as of')
  })
})

describe('formatLongDate', () => {
  it('returns the raw string for an unparseable date', () => {
    expect(formatLongDate('not-a-date')).toBe('not-a-date')
  })
})

describe('getAllReservoirsGeoJSON', () => {
  it('carries the id, volumes and reading date the detail popup needs', () => {
    const p = getAllReservoirsGeoJSON().features[0].properties!
    expect(p.codEst).toBeTruthy()
    expect(typeof p.storedHm3).toBe('number')
    expect(typeof p.capacityHm3).toBe('number')
    expect(p.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
