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
    // Copernicus EDO and the MITERD coastal WMS both return errors for every
    // request, so offering these as toggles would be a guaranteed no-op.
    expect(screen.getByRole('radio', { name: /drought status/i })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /drought status/i }))
    expect(useAppStore.getState().primaryLayer).not.toBe('drought')
  })

  it('context checkboxes toggle overlays', async () => {
    const user = userEvent.setup()
    render(<LayerTray />)
    await user.click(screen.getByRole('button', { name: /map layers/i }))
    await user.click(screen.getByRole('checkbox', { name: /supply reservoirs/i }))
    expect(useAppStore.getState().contextLayers).toEqual([])
  })
})
