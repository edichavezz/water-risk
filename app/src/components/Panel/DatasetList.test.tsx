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
  municipality: 'Sevilla', countryCode: 'es', provinceName: 'Sevilla', basin: { id: 'ES050', name: 'Guadalquivir' },
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

describe('outside the detailed region', () => {
  const marseille = {
    displayName: 'Marseille, France',
    coordinates: { lat: 43.29, lng: 5.37 },
    municipality: 'Marseille', countryCode: 'fr', region: 'FR-PAC',
    provinceName: 'Bouches-du-Rhône',
  }

  // The behaviour the coverage gate used to make impossible: this search
  // returned no rows at all and a "not available for this area" screen.
  it('still renders a list, and says how much of it is covered', async () => {
    useAppStore.setState(useAppStore.getInitialState())
    useAppStore.getState().beginSearch(marseille)
    const { coverage } = useAppStore.getState()
    for (const id of coverage!.unsupported) {
      useAppStore.getState().setResult(id, { status: 'unsupported' })
    }
    useAppStore.getState().setResult('drought', {
      status: 'available',
      data: { level: 'watch', label: 'Watch', updatedAt: '2026-07-20', source: 'Copernicus EDO' },
    })

    render(<DatasetList />)

    // Six of eleven in Marseille: Copernicus drought, the EEA bathing-water
    // register, both EFFIS fire layers, the PACA prevention plan, and the
    // VigiEau restriction level. Partial rather than limited, because those
    // last three are not continental.
    expect(screen.getByText(/partial here: 6 of 11 checks/i)).toBeInTheDocument()

    // Five empty rows is past the collapse threshold, so the tail is behind a
    // count. It must still state that the checks have no source — a collapsed
    // row the reader never opens cannot be allowed to read as "fine".
    const disclosure = screen.getByRole('button', { name: /checks have no source here/i })
    expect(disclosure).toBeInTheDocument()
    expect(screen.queryByText(/no source covers this here yet/i)).not.toBeInTheDocument()

    await userEvent.setup().click(disclosure)
    expect(screen.getAllByText(/no source covers this here yet/i).length).toBeGreaterThan(0)
  })

  // "Missing data never looks safe": an unsupported row must stay on screen,
  // under the divider, rather than being dropped like a not_applicable one.
  it('keeps unsupported rows visible below the divider', () => {
    useAppStore.setState(useAppStore.getInitialState())
    useAppStore.getState().beginSearch(marseille)
    useAppStore.getState().setResult('flood', { status: 'unsupported' })
    render(<DatasetList />)
    expect(screen.getByText(/no result for this location/i)).toBeInTheDocument()
  })
})
