// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EntryCard from './EntryCard'
import { useAppStore } from '../../store/useAppStore'
import * as geocoding from '../../services/geocoding'
import '../../i18n'

vi.mock('../../services/geocoding')
vi.mock('../../services/orchestrator', () => ({ runProfile: vi.fn(async () => {}) }))

const sevilla = {
  displayName: 'Sevilla, Andalucía', coordinates: { lat: 37.39, lng: -5.98 },
  municipio: 'Sevilla', provincia: 'Sevilla', basin: 'guadalquivir' as const,
}

beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

describe('entry card', () => {
  it('renders literal copy with optional audience below the input', () => {
    render(<EntryCard />)
    expect(screen.getByRole('heading', { name: /check water risks/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/postcode, town or address/i)).toBeInTheDocument()
    expect(screen.getByText(/optional/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /i live or own here/i })).toBeInTheDocument()
  })

  it('search works without an audience', async () => {
    const user = userEvent.setup()
    vi.mocked(geocoding.geocodeAddress).mockResolvedValue([sevilla])
    render(<EntryCard />)
    await user.type(screen.getByLabelText(/postcode/i), 'Sevilla')
    await user.click(await screen.findByRole('option', { name: /sevilla/i }))
    expect(useAppStore.getState().view).toBe('searched')
    expect(useAppStore.getState().audience).toBeNull()
  })

  it('audience chips toggle and pass through as optional context', async () => {
    const user = userEvent.setup()
    render(<EntryCard />)
    await user.click(screen.getByRole('button', { name: /buying or investing/i }))
    expect(useAppStore.getState().audience).toBe('buyer_investor')
    await user.click(screen.getByRole('button', { name: /buying or investing/i }))
    expect(useAppStore.getState().audience).toBeNull()
  })
})
