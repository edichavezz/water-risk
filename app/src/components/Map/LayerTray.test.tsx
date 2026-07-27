// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LayerTray from './LayerTray'
import { useAppStore } from '../../store/useAppStore'
import '../../i18n'

beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

describe('layer tray', () => {
  it('labels the button without a layer count', () => {
    render(<LayerTray />)
    const button = screen.getByRole('button', { name: /map layers/i })
    expect(button).toBeInTheDocument()
    // The bare count next to the label read as meaningless, so it was removed.
    expect(button.textContent).not.toMatch(/\d/)
  })

  it('primary selection is a radio group — one active at most', async () => {
    const user = userEvent.setup()
    render(<LayerTray />)
    await user.click(screen.getByRole('button', { name: /map layers/i }))
    await user.click(screen.getByRole('radio', { name: /river flood zones/i }))
    expect(useAppStore.getState().primaryLayer).toBe('flood')
    await user.click(screen.getByRole('radio', { name: /groundwater/i }))
    expect(useAppStore.getState().primaryLayer).toBe('groundwater')
    await user.click(screen.getByRole('radio', { name: /none/i }))
    expect(useAppStore.getState().primaryLayer).toBeNull()
  })

  it('disables layers whose upstream service is down', async () => {
    const user = userEvent.setup()
    render(<LayerTray />)
    await user.click(screen.getByRole('button', { name: /map layers/i }))
    // The MITERD coastal WMS gateway returns a server error for every request,
    // so offering it as a toggle would be a guaranteed no-op.
    const coastal = screen.getByRole('radio', { name: /coastal zone/i })
    expect(coastal).toBeDisabled()
    await user.click(coastal)
    expect(useAppStore.getState().primaryLayer).not.toBe('coastalFlood')
  })

  it('context checkboxes toggle overlays', async () => {
    const user = userEvent.setup()
    render(<LayerTray />)
    await user.click(screen.getByRole('button', { name: /map layers/i }))
    await user.click(screen.getByRole('checkbox', { name: /supply reservoirs/i }))
    expect(useAppStore.getState().contextLayers).toEqual([])
  })
})
