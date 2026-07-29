// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LayerTray from './LayerTray'
import { useAppStore } from '../../store/useAppStore'
import { DATASETS } from '../../registry/datasets'
import '../../i18n'

beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

describe('layer tray', () => {
  it('names the card without a layer count', () => {
    render(<LayerTray />)
    const card = screen.getByText(/map layers/i)
    expect(card).toBeInTheDocument()
    // The bare count next to the label read as meaningless, so it was removed.
    expect(card.textContent).not.toMatch(/\d/)
  })

  it('opens expanded, and the chevron folds it to a pill', async () => {
    const user = userEvent.setup()
    render(<LayerTray />)
    // Layers and the legend now share one card, shown expanded by default.
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /collapse map layers/i }))
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.getByText(/map layers/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /expand map layers/i }))
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
  })

  it('primary selection is a radio group — one active at most', async () => {
    const user = userEvent.setup()
    render(<LayerTray />)
    await user.click(screen.getByRole('radio', { name: /river flood zones/i }))
    expect(useAppStore.getState().primaryLayer).toBe('flood')
    await user.click(screen.getByRole('radio', { name: /groundwater/i }))
    expect(useAppStore.getState().primaryLayer).toBe('groundwater')
    await user.click(screen.getByRole('radio', { name: /none/i }))
    expect(useAppStore.getState().primaryLayer).toBeNull()
  })

  it('disables layers whose upstream service is down', async () => {
    const user = userEvent.setup()
    // Every layer currently has a live source, so this exercises the mechanism
    // rather than a specific dataset: these upstreams do go down (MITECO's
    // whole WMS gateway is down as of writing, and Copernicus moved hosts),
    // and a toggle that cannot paint must not be offered as if it can.
    const floodDataset = DATASETS.find(d => d.id === 'flood')!
    floodDataset.mapUnavailable = true
    try {
      render(<LayerTray />)
      const flood = screen.getByRole('radio', { name: /river flood zones/i })
      expect(flood).toBeDisabled()
      await user.click(flood)
      expect(useAppStore.getState().primaryLayer).not.toBe('flood')
    } finally {
      delete floodDataset.mapUnavailable
    }
  })

  it('context checkboxes toggle overlays', async () => {
    const user = userEvent.setup()
    render(<LayerTray />)
    await user.click(screen.getByRole('checkbox', { name: /supply reservoirs/i }))
    expect(useAppStore.getState().contextLayers).toEqual([])
  })
})
