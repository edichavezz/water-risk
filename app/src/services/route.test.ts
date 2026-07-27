import { describe, it, expect } from 'vitest'
import { parseRoute, serializeRoute } from './route'

describe('route state', () => {
  it('round-trips a full state', () => {
    const s = serializeRoute({ q: 'Sevilla', lat: 37.39, lng: -5.98, aud: 'buyer_investor', ds: 'flood', mode: 'ai' })
    expect(parseRoute(s)).toEqual({ q: 'Sevilla', lat: 37.39, lng: -5.98, aud: 'buyer_investor', ds: 'flood', mode: 'ai' })
  })
  it('round-trips the About page alongside a live search', () => {
    const s = serializeRoute({ page: 'about', q: 'Sevilla', lat: 37.39, lng: -5.98 })
    expect(s).toContain('page=about')
    expect(parseRoute(s)).toEqual({ page: 'about', q: 'Sevilla', lat: 37.39, lng: -5.98 })
  })
  it('keeps the map page out of the URL', () => {
    expect(serializeRoute({})).toBe('')
    expect(parseRoute('?page=map')).toEqual({})
  })
  it('drops unknown or malformed params safely', () => {
    expect(parseRoute('?aud=farmer&ds=nonsense&lat=abc&mode=chat&x=1')).toEqual({})
  })
  it('drops lat without lng and vice versa', () => {
    expect(parseRoute('?lat=37.1')).toEqual({})
  })
  it('serializes empty state to empty string', () => {
    expect(serializeRoute({})).toBe('')
  })
})
