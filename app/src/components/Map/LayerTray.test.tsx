// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
    await user.click(screen.getByRole('radio', { name: /drought/i }))
    expect(useAppStore.getState().primaryLayer).toBe('drought')
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

  it('disables a layer the searched place has no data for', async () => {
    const user = userEvent.setup()
    // A coastal layer for an inland town: the panel drops the row, so the map
    // must not go on offering a toggle that would paint nothing.
    useAppStore.setState({
      results: { coastalFlood: { status: 'not_applicable' } },
    })
    render(<LayerTray />)

    const coastal = screen.getByRole('radio', { name: /coastal/i })
    expect(coastal).toBeDisabled()
    await user.click(coastal)
    expect(useAppStore.getState().primaryLayer).not.toBe('coastalFlood')

    // A dataset that does apply is untouched.
    expect(screen.getByRole('radio', { name: /river flood zones/i })).not.toBeDisabled()
  })

  it('keeps offering layers whose reading is merely missing at this point', () => {
    // "Outside the mapped zone" is a reason to look at the map, not to lock it:
    // the raster still shows the zones around the point.
    useAppStore.setState({ results: { flood: { status: 'unavailable' } } })
    render(<LayerTray />)
    expect(screen.getByRole('radio', { name: /river flood zones/i })).not.toBeDisabled()
  })

  it('fails closed for a missing dated fire forecast', () => {
    useAppStore.setState({ results: { fireDanger: { status: 'unavailable' } } })
    render(<LayerTray />)
    expect(screen.getByRole('radio', { name: /fire danger forecast/i })).toBeDisabled()
  })

  it('drops a selected layer that stops applying, rather than stranding it', async () => {
    useAppStore.setState({ primaryLayer: 'coastalFlood' })
    const { rerender } = render(<LayerTray />)
    expect(useAppStore.getState().primaryLayer).toBe('coastalFlood')

    useAppStore.setState({ results: { coastalFlood: { status: 'not_applicable' } } })
    rerender(<LayerTray />)

    await waitFor(() => expect(useAppStore.getState().primaryLayer).toBeNull())
  })
})
