// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../../i18n'
import AppHeader from './AppHeader'
import { useAppStore } from '../../store/useAppStore'

describe('AppHeader', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useAppStore.setState({ page: 'map', view: 'entry', primaryLayer: null })
  })

  it('names the app as the page heading, untranslated', async () => {
    render(<AppHeader />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Fire and Rain')

    await i18n.changeLanguage('es')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Fire and Rain')
  })

  it('shows the tagline in the active language', async () => {
    render(<AppHeader />)
    expect(screen.getByText('Water and fire risk across the Mediterranean')).toBeInTheDocument()

    await i18n.changeLanguage('es')
    expect(
      screen.getByText('Riesgos de agua e incendio en el Mediterráneo'),
    ).toBeInTheDocument()
  })

  it('offers About as the banner destination while the map is showing', () => {
    render(<AppHeader />)

    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'About' })).toBeInTheDocument()
  })

  it('becomes a way back once About is the page', () => {
    useAppStore.setState({ page: 'about' })
    render(<AppHeader />)

    expect(screen.getByRole('button', { name: /back to map/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'About' })).not.toBeInTheDocument()
  })

  it('switches the page without touching the map view or an active search', async () => {
    const user = userEvent.setup()
    useAppStore.setState({ view: 'searched', primaryLayer: 'flood' })
    render(<AppHeader />)

    await user.click(screen.getByRole('button', { name: 'About' }))

    const state = useAppStore.getState()
    expect(state.page).toBe('about')
    expect(state.view).toBe('searched')
    expect(state.primaryLayer).toBe('flood')
    // The control becomes the way back, and the search is still standing.
    expect(screen.getByRole('button', { name: /back to map/i })).toBeInTheDocument()
  })

  it('opens no dialog — About is a page, not a modal', async () => {
    const user = userEvent.setup()
    render(<AppHeader />)

    await user.click(screen.getByRole('button', { name: 'About' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
