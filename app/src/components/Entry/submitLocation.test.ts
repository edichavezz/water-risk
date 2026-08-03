import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrchestratorCallbacks } from '../../services/orchestrator'
import type { PlaceContext } from '../../types/place'
import { useAppStore } from '../../store/useAppStore'

const pending = vi.hoisted(() => [] as Array<{
  callbacks: OrchestratorCallbacks
  resolve: () => void
}>)

vi.mock('../../services/orchestrator', () => ({
  runProfile: vi.fn(async (_place, _datasets, callbacks: OrchestratorCallbacks) =>
    await new Promise<void>(resolve => pending.push({ callbacks, resolve }))),
}))

import { submitLocation } from './submitLocation'

const place = (name: string, lng: number): PlaceContext => ({
  displayName: name, municipality: name, countryCode: 'fr',
  coordinates: { lat: 44.84, lng },
})

beforeEach(() => {
  pending.length = 0
  useAppStore.setState(useAppStore.getInitialState())
})

describe('overlapping searches', () => {
  it('ignores results that arrive from an older location', async () => {
    const first = submitLocation(place('First', -0.58))
    const second = submitLocation(place('Second', 2.35))
    expect(pending).toHaveLength(2)

    pending[0].callbacks.onResult('activeFire', { status: 'available', data: { from: 'first' } })
    expect(useAppStore.getState().results.activeFire).toBeUndefined()

    pending[1].callbacks.onResult('activeFire', { status: 'available', data: { from: 'second' } })
    expect(useAppStore.getState().results.activeFire?.data).toEqual({ from: 'second' })

    pending[0].resolve()
    pending[1].resolve()
    await Promise.all([first, second])
  })
})
