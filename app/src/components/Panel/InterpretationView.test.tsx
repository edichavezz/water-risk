// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import InterpretationView from './InterpretationView'
import { useAppStore } from '../../store/useAppStore'
import '../../i18n'

vi.mock('../../services/ai', () => ({ requestInterpretation: vi.fn() }))

const sevilla = {
  displayName: 'Sevilla', coordinates: { lat: 37.39, lng: -5.98 },
  municipality: 'Sevilla', provinceName: 'Sevilla', basin: { id: 'ES050', name: 'Guadalquivir' },
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
  useAppStore.getState().beginSearch(sevilla)
})

describe('interpretation view', () => {
  it('ready state shows AI-assisted label on the content, basis and questions', () => {
    useAppStore.getState().setInterpretation({
      status: 'ready', scope: { type: 'location' },
      text: 'Calm interpretation.', questions: ['Q one?'], basis: ['flood'],
    })
    render(<InterpretationView />)
    expect(screen.getByText(/ai-assisted/i)).toBeInTheDocument()
    expect(screen.getByText('Calm interpretation.')).toBeInTheDocument()
    expect(screen.getByText(/based on/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /q one\?/i })).toBeInTheDocument()
  })

  it('stale state offers regeneration instead of auto-regenerating', () => {
    useAppStore.getState().setInterpretation({
      status: 'stale', scope: { type: 'location' }, text: 'Old text.',
    })
    render(<InterpretationView />)
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument()
  })

  it('follow-up input only appears once an interpretation is ready', () => {
    useAppStore.getState().setInterpretation({ status: 'loading', scope: { type: 'location' } })
    const { rerender } = render(<InterpretationView />)
    expect(screen.queryByLabelText(/follow-up/i)).not.toBeInTheDocument()
    useAppStore.getState().setInterpretation({ status: 'ready', text: 'T', questions: [], basis: [] })
    rerender(<InterpretationView />)
    expect(screen.getByLabelText(/follow-up/i)).toBeInTheDocument()
  })
})
