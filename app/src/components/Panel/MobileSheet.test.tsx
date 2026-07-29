// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MobileSheet from './MobileSheet'
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

describe('mobile sheet', () => {
  it('starts at peek with the place name and explicit expand control', () => {
    render(<MobileSheet />)
    // municipio and provincia are both "Sevilla" in this fixture
    expect(screen.getAllByText(/sevilla/i)[0]).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /expand results/i })).toBeInTheDocument()
  })

  it('expands to half showing the dataset list', async () => {
    const user = userEvent.setup()
    render(<MobileSheet />)
    await user.click(screen.getByRole('button', { name: /expand results/i }))
    expect(screen.getByRole('button', { name: /river flood zones/i })).toBeInTheDocument()
  })
})
