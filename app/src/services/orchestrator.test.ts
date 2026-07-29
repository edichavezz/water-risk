import { describe, it, expect, vi } from 'vitest'
import { runProfile } from './orchestrator'
import type { DatasetDef } from '../registry/datasets'
import type { PlaceContext } from '../types/place'
import { NON_SAFE_STATUSES, type DatasetStatus } from '../types/workspace'

const loc: PlaceContext = {
  displayName: 'X', coordinates: { lat: 37, lng: -5 }, municipality: 'X',
}

function def(id: string, fetch: DatasetDef['fetch']): DatasetDef {
  return {
    id: id as DatasetDef['id'], hazard: 'water', category: 'hazard',
    source: { name: 's' }, mapRole: 'none', aiAllowed: true,
    audienceWeight: { resident_owner: 1, buyer_investor: 1 },
    defaultOrder: 1, applicability: () => 'covered', fetch,
  }
}

describe('profile orchestrator', () => {
  it('marks loading immediately, then reports settled results', async () => {
    const events: Array<[string, string]> = []
    const cb = { onResult: (id: string, r: { status: string }) => events.push([id, r.status]) }
    await runProfile(loc, [
      def('flood', async () => ({ status: 'available', data: 1 })),
      def('drought', async () => ({ status: 'unavailable' })),
    ], cb)
    expect(events.slice(0, 2)).toEqual([['flood', 'loading'], ['drought', 'loading']])
    expect(events).toContainEqual(['flood', 'available'])
    expect(events).toContainEqual(['drought', 'unavailable'])
  })

  it('one failing fetch never blocks or breaks the others', async () => {
    const results: Record<string, string> = {}
    await runProfile(loc, [
      def('flood', async () => { throw new Error('boom') }),
      def('drought', async () => ({ status: 'available', data: 2 })),
    ], { onResult: (id, r) => { results[id] = r.status } })
    expect(results.flood).toBe('error')
    expect(results.drought).toBe('available')
  })

  it('does not wait for slow sources to report fast ones', async () => {
    vi.useFakeTimers()
    const seen: string[] = []
    const p = runProfile(loc, [
      def('flood', () => new Promise(res => setTimeout(() => res({ status: 'available' }), 5000))),
      def('drought', async () => ({ status: 'available' })),
    ], { onResult: (id, r) => { if (r.status !== 'loading') seen.push(id) } })
    await vi.advanceTimersByTimeAsync(0)
    expect(seen).toEqual(['drought'])
    await vi.advanceTimersByTimeAsync(5000)
    await p
    expect(seen).toEqual(['drought', 'flood'])
    vi.useRealTimers()
  })

  // Correctness, not efficiency. Before the short-circuit, `flood` applied
  // everywhere: a search in Italy sampled three SNCZI layers, failed all three,
  // and landed as `error` — a Retry button that could never succeed.
  it('never fetches a dataset that does not apply here', async () => {
    const fetched: string[] = []
    const results: Record<string, string> = {}

    const track = (id: string, applies: DatasetDef['applicability']): DatasetDef => ({
      ...def(id, async () => {
        fetched.push(id)
        return { status: 'available', data: 1 }
      }),
      applicability: applies,
    })

    await runProfile(
      loc,
      [
        track('flood', () => 'unsupported'),
        track('bathingWater', () => 'not_applicable'),
        track('drought', () => 'covered'),
      ],
      { onResult: (id, r) => { results[id] = r.status } },
    )

    expect(fetched).toEqual(['drought'])
    expect(results.flood).toBe('unsupported')
    expect(results.bathingWater).toBe('not_applicable')
    expect(results.drought).toBe('available')
  })

  // "Missing data never looks safe": the status a non-covered dataset lands on
  // must be one the UI is forbidden from styling as a low-risk finding.
  it('reports an unsupported dataset as a non-safe status', async () => {
    const results: Record<string, string> = {}
    await runProfile(
      loc,
      [{ ...def('flood', async () => ({ status: 'available' })), applicability: () => 'unsupported' as const }],
      { onResult: (id, r) => { results[id] = r.status } },
    )
    expect(NON_SAFE_STATUSES).toContain(results.flood as DatasetStatus)
  })
})
