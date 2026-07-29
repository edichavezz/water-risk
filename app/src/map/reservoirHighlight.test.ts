import { describe, it, expect } from 'vitest'
import type maplibregl from 'maplibre-gl'
import { applyReservoirHighlight, fitReservoirsInView, fitPadding } from './dataLayers'
import { getReservoirsForLocation, allReservoirCodEsts } from '../services/reservoirs'
import type { SearchResult } from '../types'

interface StateCall { id: string; state: Record<string, boolean> }

function fakeMap(overrides: Partial<Record<string, unknown>> = {}) {
  const calls: StateCall[] = []
  const moves: Record<string, unknown>[] = []
  const map = {
    getSource: () => ({}),
    setFeatureState: (f: { id: string }, state: Record<string, boolean>) =>
      calls.push({ id: f.id, state }),
    getCanvas: () => ({ getBoundingClientRect: () => ({ width: 1200, height: 800 }) }),
    cameraForBounds: () => ({ center: { lng: -4, lat: 37.5 }, zoom: 6 }),
    jumpTo: (o: Record<string, unknown>) => moves.push(o),
    easeTo: (o: Record<string, unknown>) => moves.push(o),
    ...overrides,
  }
  return { map: map as unknown as maplibregl.Map, calls, moves }
}

const SEVILLA: SearchResult = {
  displayName: 'Sevilla, Andalucía, Spain',
  coordinates: { lat: 37.3891, lng: -5.9845 },
  municipality: 'Sevilla',
  provinceName: 'Sevilla',
}

describe('reservoir results', () => {
  it('carry the codEst the map highlight keys on', () => {
    const rs = getReservoirsForLocation(SEVILLA)
    expect(rs.length).toBeGreaterThan(0)
    for (const r of rs) expect(r.codEst).toBeTruthy()
  })
})

describe('applyReservoirHighlight', () => {
  it('highlights the given set and dims every other reservoir', () => {
    const { map, calls } = fakeMap()
    applyReservoirHighlight(map, ['E01', 'E02'])

    const highlighted = calls.filter(c => c.state.highlighted === true).map(c => c.id)
    const dimmed = calls.filter(c => c.state.dimmed === true).map(c => c.id)
    expect(highlighted).toEqual(['E01', 'E02'])
    expect(dimmed).not.toContain('E01')
    expect(dimmed).toHaveLength(allReservoirCodEsts().length - 2)
  })

  it('clears the previous set explicitly — feature-state merges, it never replaces', () => {
    const first = fakeMap()
    applyReservoirHighlight(first.map, ['E01'])

    const second = fakeMap()
    applyReservoirHighlight(second.map, ['E02'])
    // E01 must be actively switched off, not just left out of the new set.
    expect(second.calls).toContainEqual({ id: 'E01', state: { highlighted: false } })
    expect(second.calls.filter(c => c.state.highlighted === true).map(c => c.id)).toEqual(['E02'])
  })

  it('an empty set returns every marker to neutral and highlights nothing', () => {
    const first = fakeMap()
    applyReservoirHighlight(first.map, ['E01'])

    const { map, calls } = fakeMap()
    applyReservoirHighlight(map, [])
    expect(calls.every(c => Object.values(c.state).every(v => v === false))).toBe(true)
  })
})

describe('fitReservoirsInView', () => {
  it('never fits below the zoom where reservoir markers start drawing', () => {
    const { map, moves } = fakeMap({
      cameraForBounds: () => ({ center: { lng: -3, lat: 37.9 }, zoom: 4 }),
    })
    fitReservoirsInView(map, [-3, 37.9], [[-2.79, 38.17]], { animate: false, maxZoom: 11 })
    expect(moves).toHaveLength(1)
    // Markers start drawing at zoom 6, so a wider fit than that would show
    // nothing at all.
    expect(moves[0].zoom).toBe(6)
  })

  it('never zooms in past the caller ceiling', () => {
    const { map, moves } = fakeMap({
      cameraForBounds: () => ({ center: { lng: -3, lat: 37.9 }, zoom: 14 }),
    })
    fitReservoirsInView(map, [-3, 37.9], [[-3.01, 37.91]], { animate: false, maxZoom: 11 })
    expect(moves[0].zoom).toBe(11)
  })

  it('does nothing when there is nothing to bring into view', () => {
    const { map, moves } = fakeMap()
    fitReservoirsInView(map, [-3, 37.9], [], { animate: false, maxZoom: 11 })
    expect(moves).toHaveLength(0)
  })
})

describe('fitPadding', () => {
  it('keeps the fit clear of the desktop workspace panel', () => {
    const { map } = fakeMap()
    expect(fitPadding(map).left).toBeGreaterThan(300)
  })

  it('pads the bottom instead on narrow viewports, where the sheet lives', () => {
    const { map } = fakeMap({
      getCanvas: () => ({ getBoundingClientRect: () => ({ width: 420, height: 800 }) }),
    })
    const pad = fitPadding(map)
    expect(pad.left).toBe(60)
    expect(pad.bottom).toBeGreaterThan(200)
  })
})
