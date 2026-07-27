// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../../i18n'
import AboutPage from './AboutPage'
import { DATASETS } from '../../registry/datasets'
import { useAppStore } from '../../store/useAppStore'

describe('AboutPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useAppStore.setState({ page: 'about', view: 'entry', searchFocusNonce: 0 })
  })

  it('is a page, not a dialog', () => {
    render(<AboutPage />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('leads with what the project is and why it exists', () => {
    render(<AboutPage />)
    expect(
      screen.getByRole('heading', { name: /public water data for one address/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/scattered/i)).toBeInTheDocument()
  })

  it('explains how the AI is used and what the owner/buyer answer feeds', () => {
    render(<AboutPage />)
    expect(screen.getByRole('heading', { name: 'How the AI is used' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /owner or buyer/i }),
    ).toBeInTheDocument()
    // Both real uses of the answer: dataset ordering and model framing.
    expect(screen.getByText(/reorders the checks/i)).toBeInTheDocument()
    expect(screen.getByText(/passed to the model as framing/i)).toBeInTheDocument()
  })

  it('asks a plain-language question for every registered dataset, with its source', () => {
    render(<AboutPage />)
    for (const dataset of DATASETS) {
      const question = i18n.t(`about.dataItems.${dataset.id}.question`)
      expect(question).not.toBe(`about.dataItems.${dataset.id}.question`)
      expect(screen.getByRole('heading', { name: question })).toBeInTheDocument()
      expect(screen.getAllByText(new RegExp(dataset.source.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        .length).toBeGreaterThan(0)
    }
  })

  it('keeps the coverage and not-advice notices that the old dialog carried', () => {
    render(<AboutPage />)
    expect(screen.getByRole('heading', { name: 'Where it works' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Not professional advice' })).toBeInTheDocument()
  })

  it('credits the author, her site and the course', () => {
    render(<AboutPage />)
    expect(screen.getByRole('link', { name: 'editachavez.com' })).toHaveAttribute(
      'href',
      'https://editachavez.com',
    )
    expect(screen.getByRole('link', { name: 'Terra.do' })).toHaveAttribute(
      'href',
      'https://terra.do',
    )
    expect(screen.getByText(/Edita Chávez/)).toBeInTheDocument()
  })

  it('sends the reader to the map, asking for the search field, without clearing state', async () => {
    const user = userEvent.setup()
    render(<AboutPage />)

    await user.click(screen.getAllByRole('button', { name: 'Try it out' })[0])

    const state = useAppStore.getState()
    expect(state.page).toBe('map')
    expect(state.searchFocusNonce).toBe(1)
  })

  it('does not steal focus into the search field when a search is already open', async () => {
    const user = userEvent.setup()
    useAppStore.setState({ view: 'searched' })
    render(<AboutPage />)

    await user.click(screen.getAllByRole('button', { name: 'Try it out' })[0])

    const state = useAppStore.getState()
    expect(state.page).toBe('map')
    expect(state.view).toBe('searched')
    expect(state.searchFocusNonce).toBe(0)
  })

  it('translates the whole page', async () => {
    await i18n.changeLanguage('es')
    render(<AboutPage />)
    expect(screen.getByRole('heading', { name: 'Cómo se usa la IA' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Pruébalo' }).length).toBeGreaterThan(0)
  })
})
