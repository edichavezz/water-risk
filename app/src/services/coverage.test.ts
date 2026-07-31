import { describe, it, expect } from 'vitest'
import { lookupCoverage, getCoverageGeoJSON } from './coverage'

describe('coverage lookup', () => {
  it('supports a point in Sevilla', () => {
    const r = lookupCoverage({ lat: 37.39, lng: -5.98 })
    expect(r.supported).toBe(true)
    expect(r.regionId).toBe('andalucia')
    expect(r.datasets.length).toBeGreaterThan(0)
  })
  it('supports Tarifa, the southernmost town on the mainland', () => {
    // Regression: the 24-point hand-drawn boundary this replaced ran north of
    // Tarifa, so a Cádiz town was told it sat outside the covered region.
    expect(lookupCoverage({ lat: 36.0143, lng: -5.6035 }).supported).toBe(true)
  })

  it('does not claim groundwater anywhere', () => {
    // Its source data was fabricated and removed, and no live service
    // publishes a replacement — so the coverage box must not promise it.
    expect(lookupCoverage({ lat: 37.39, lng: -5.98 }).datasets).not.toContain('groundwater')
  })

  it('supports Málaga and Granada', () => {
    expect(lookupCoverage({ lat: 36.72, lng: -4.42 }).supported).toBe(true)
    expect(lookupCoverage({ lat: 37.18, lng: -3.60 }).supported).toBe(true)
  })
  it('does not support Madrid or Lisbon', () => {
    expect(lookupCoverage({ lat: 40.42, lng: -3.70 })).toEqual({ supported: false, datasets: [] })
    expect(lookupCoverage({ lat: 38.72, lng: -9.14 }).supported).toBe(false)
  })
  it('exposes coverage geometry for the map', () => {
    const fc = getCoverageGeoJSON()
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features[0].properties?.regionId).toBe('andalucia')
  })
})
