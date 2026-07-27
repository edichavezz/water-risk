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
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Water Risk Explorer')

    await i18n.changeLanguage('es')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Water Risk Explorer')
  })

  it('shows the tagline in the active language', async () => {
    render(<AppHeader />)
    expect(screen.getByText('Check water risks for a place in Spain')).toBeInTheDocument()

    await i18n.changeLanguage('es')
    expect(
      screen.getByText('Consulta los riesgos hídricos de un lugar de España'),
    ).toBeInTheDocument()
  })

  it('offers Map and About as banner navigation, with the map current by default', () => {
    render(<AppHeader />)

    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'About' })).not.toHaveAttribute('aria-current')
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
    expect(screen.getByRole('button', { name: 'About' })).toHaveAttribute('aria-current', 'page')
  })

  it('opens no dialog — About is a page, not a modal', async () => {
    const user = userEvent.setup()
    render(<AppHeader />)

    await user.click(screen.getByRole('button', { name: 'About' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
