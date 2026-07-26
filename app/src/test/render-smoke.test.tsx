// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('component test infrastructure', () => {
  it('renders into jsdom and uses jest-dom matchers', () => {
    render(<button type="button">Check this area</button>)
    expect(screen.getByRole('button', { name: /check this area/i })).toBeInTheDocument()
  })
})
