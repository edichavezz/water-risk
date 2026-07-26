// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../../i18n'
import AppHeader from './AppHeader'
import { DATASETS } from '../../registry/datasets'

describe('AppHeader', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
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

  it('keeps the About dialog closed until the button is pressed', async () => {
    const user = userEvent.setup()
    render(<AppHeader />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'About' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('returns focus to the About button after closing', async () => {
    const user = userEvent.setup()
    render(<AppHeader />)

    const trigger = screen.getByRole('button', { name: 'About' })
    await user.click(trigger)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('lists every registered dataset source in the dialog', async () => {
    const user = userEvent.setup()
    render(<AppHeader />)
    await user.click(screen.getByRole('button', { name: 'About' }))

    const dialog = screen.getByRole('dialog')
    for (const dataset of DATASETS) {
      expect(dialog).toHaveTextContent(dataset.source.name)
    }
  })
})
