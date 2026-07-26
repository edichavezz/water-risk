// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LayerTray from './LayerTray'
import { useAppStore } from '../../store/useAppStore'
import '../../i18n'

beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

describe('layer tray', () => {
  it('shows count of visible data layers', () => {
    render(<LayerTray />)
    // reservoirs context is on by default
    expect(screen.getByRole('button', { name: /map layers · 1/i })).toBeInTheDocument()
  })

  it('primary selection is a radio group — one active at most', async () => {
    const user = userEvent.setup()
    render(<LayerTray />)
    await user.click(screen.getByRole('button', { name: /map layers/i }))
    await user.click(screen.getByRole('radio', { name: /river flood zones/i }))
    expect(useAppStore.getState().primaryLayer).toBe('flood')
    await user.click(screen.getByRole('radio', { name: /drought status/i }))
    expect(useAppStore.getState().primaryLayer).toBe('drought')
    await user.click(screen.getByRole('radio', { name: /none/i }))
    expect(useAppStore.getState().primaryLayer).toBeNull()
  })

  it('context checkboxes toggle overlays', async () => {
    const user = userEvent.setup()
    render(<LayerTray />)
    await user.click(screen.getByRole('button', { name: /map layers/i }))
    await user.click(screen.getByRole('checkbox', { name: /supply reservoirs/i }))
    expect(useAppStore.getState().contextLayers).toEqual([])
  })
})
