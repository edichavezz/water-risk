// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import DatasetDetail from './DatasetDetail'
import { useAppStore } from '../../store/useAppStore'
import '../../i18n'

beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

describe('DatasetDetail fire records', () => {
  it('lists recent mapped fires with exact dates, place, area and distance', () => {
    useAppStore.setState({
      selectedDataset: 'fireHistory',
      panelDepth: 'detail',
      results: {
        fireHistory: {
          status: 'available',
          data: {
            fires: [{
              date: '2026-07-29', areaHa: 318, distanceKm: 12.4,
              commune: 'Pozzilli', province: 'Isernia',
            }],
            radiusKm: 30, since: 2012, source: 'Copernicus EFFIS',
          },
        },
      },
    })

    render(<DatasetDetail />)
    expect(screen.getAllByText(/29 July 2026/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Pozzilli/)).toBeInTheDocument()
    expect(screen.getAllByText(/318 ha/).length).toBeGreaterThan(0)
    expect(screen.getByText(/12.4 km/)).toBeInTheDocument()
  })

  it('lists a recent thermal detection with its exact UTC time and distance', () => {
    useAppStore.setState({
      selectedDataset: 'activeFire',
      panelDepth: 'detail',
      results: {
        activeFire: {
          status: 'available',
          data: {
            detections: [{
              id: 'n20-1', detectedAt: '2026-08-03T11:42:00Z',
              lat: 44.84, lng: -0.58, distanceKm: 4.2,
              confidence: 'nominal', satellite: 'NOAA-20', type: 'vegetation',
            }],
            radiusKm: 30, windowHours: 24,
            through: '2026-08-03T12:00:00Z', source: 'NASA FIRMS',
          },
        },
      },
    })

    render(<DatasetDetail />)
    expect(screen.getAllByText(/3 August 2026/).length).toBeGreaterThan(0)
    expect(screen.getByText(/11:42 UTC/)).toBeInTheDocument()
    expect(screen.getByText(/4.2 km/)).toBeInTheDocument()
    expect(screen.getByText(/not a confirmed wildfire incident/i)).toBeInTheDocument()
  })
})
