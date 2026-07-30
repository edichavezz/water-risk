// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReservoirLevels from './ReservoirLevels'
import type { Reservoir } from '../../types'
import '../../i18n'

const base: Reservoir = {
  codEst: 'E01',
  name: 'Bermejales',
  fillPercent: 34,
  fillPercentAsOf: '2026-07-29',
  mean5yr: 52,
  mean10yr: 61,
  distanceKm: 12,
  basin: 'GUADALQUIVIR',
  systemName: 'EMASESA',
}

describe('ReservoirLevels', () => {
  it('lists each reservoir with its current level', () => {
    render(<ReservoirLevels reservoirs={[base]} />)
    expect(screen.getByText('Bermejales')).toBeInTheDocument()
    expect(screen.getByText('34%')).toBeInTheDocument()
  })

  it('shows both averages with the shortfall against each', () => {
    render(<ReservoirLevels reservoirs={[base]} />)
    // 34 vs 52 -> 18 below; 34 vs 61 -> 27 below
    expect(screen.getByText(/5-yr avg 52%/)).toBeInTheDocument()
    expect(screen.getByText(/10-yr avg 61%/)).toBeInTheDocument()
    expect(screen.getByText(/18/)).toBeInTheDocument()
    expect(screen.getByText(/27/)).toBeInTheDocument()
  })

  it('states the direction in words, not by colour or arrow alone', () => {
    render(<ReservoirLevels reservoirs={[base]} />)
    // Spec §14: colour is never the sole carrier of meaning.
    expect(screen.getByLabelText(/18 pts below the 5-year average/i)).toBeInTheDocument()
  })

  it('omits an average the station has too little history for', () => {
    render(<ReservoirLevels reservoirs={[{ ...base, mean5yr: null }]} />)
    expect(screen.queryByText(/5-yr avg/)).not.toBeInTheDocument()
    expect(screen.getByText(/10-yr avg 61%/)).toBeInTheDocument()
  })

  it('never renders a missing average as zero', () => {
    render(<ReservoirLevels reservoirs={[{ ...base, mean5yr: null, mean10yr: null }]} />)
    expect(screen.queryByText(/avg 0%/)).not.toBeInTheDocument()
  })

  it('reports a level above the average as above', () => {
    render(<ReservoirLevels reservoirs={[{ ...base, fillPercent: 80 }]} />)
    expect(screen.getByLabelText(/28 pts above the 5-year average/i)).toBeInTheDocument()
  })
})
