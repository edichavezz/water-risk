// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DatasetList from './DatasetList'
import { useAppStore } from '../../store/useAppStore'
import '../../i18n'

vi.mock('../../services/orchestrator', () => ({ runProfile: vi.fn(async () => {}) }))

const sevilla = {
  displayName: 'Sevilla', coordinates: { lat: 37.39, lng: -5.98 },
  municipio: 'Sevilla', provincia: 'Sevilla', basin: 'guadalquivir' as const,
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
  useAppStore.getState().beginSearch(sevilla)
})

describe('dataset list', () => {
  it('renders a row per applicable dataset with per-state presentation', () => {
    useAppStore.getState().setResult('flood', { status: 'available', data: { inZone: false, source: 'SNCZI' } })
    useAppStore.getState().setResult('drought', { status: 'error', error: 'x' })
    render(<DatasetList />)
    expect(screen.getByText(/outside the mapped/i)).toBeInTheDocument()
    expect(screen.getByText(/source could not be reached/i)).toBeInTheDocument()
  })

  it('error rows carry a retry affordance', () => {
    useAppStore.getState().setResult('drought', { status: 'error', error: 'x' })
    render(<DatasetList />)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('lists rows with a reading before rows without, under a divider', () => {
    useAppStore.getState().setResult('flood', { status: 'unavailable' })
    useAppStore.getState().setResult('drought', { status: 'error', error: 'x' })
    useAppStore.getState().setResult('reservoirs', { status: 'available', data: [] })
    render(<DatasetList />)

    const rendered = screen.getByText(/no result for this location/i)
    expect(rendered).toBeInTheDocument()

    // Reservoirs (has a reading) must appear before the divider; the two
    // empty rows after it.
    const body = document.body.textContent ?? ''
    expect(body.indexOf('Reservoir')).toBeLessThan(body.indexOf('No result for this location'))
  })

  it('shows no divider while everything is still loading', () => {
    render(<DatasetList />)
    expect(screen.queryByText(/no result for this location/i)).not.toBeInTheDocument()
  })

  it('selecting a row opens detail and activates its primary layer', async () => {
    const user = userEvent.setup()
    useAppStore.getState().setResult('flood', { status: 'available', data: { inZone: false, source: 'SNCZI' } })
    render(<DatasetList />)
    await user.click(screen.getByRole('button', { name: /river flood zones/i }))
    expect(useAppStore.getState().panelDepth).toBe('detail')
    expect(useAppStore.getState().primaryLayer).toBe('flood')
  })
})
