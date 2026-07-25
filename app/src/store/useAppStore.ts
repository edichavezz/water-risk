import { create } from 'zustand'
import type { Language, SearchResult } from '../types'
import type {
  Audience, DatasetId, DatasetResult, InterpretationState,
  PanelDepth, PanelMode, WorkspaceView,
} from '../types/workspace'
import { lookupCoverage, type CoverageResult } from '../services/coverage'
import { getDataset } from '../registry/datasets'

const MAX_CONTEXT_LAYERS = 2

interface AppStore {
  language: Language
  view: WorkspaceView
  location: SearchResult | null
  audience: Audience | null
  coverage: CoverageResult | null
  panelMode: PanelMode
  panelDepth: PanelDepth
  selectedDataset: DatasetId | null
  primaryLayer: DatasetId | null
  contextLayers: DatasetId[]
  results: Partial<Record<DatasetId, DatasetResult>>
  interpretation: InterpretationState

  setLanguage: (lang: Language) => void
  setAudience: (a: Audience | null) => void
  beginSearch: (location: SearchResult) => void
  goHome: () => void
  setResult: (id: DatasetId, result: DatasetResult) => void
  selectDataset: (id: DatasetId) => void
  backToList: () => void
  openDataMode: () => void
  openAiMode: () => void
  setPrimaryLayer: (id: DatasetId | null) => void
  toggleContextLayer: (id: DatasetId) => void
  setInterpretation: (partial: Partial<InterpretationState>) => void
}

const idleInterpretation: InterpretationState = { status: 'idle', scope: null }

export const useAppStore = create<AppStore>((set, get) => ({
  language: 'en',
  view: 'entry',
  location: null,
  audience: null,
  coverage: null,
  panelMode: 'data',
  panelDepth: 'list',
  selectedDataset: null,
  primaryLayer: null,
  contextLayers: ['reservoirs'],
  results: {},
  interpretation: idleInterpretation,

  setLanguage: language =>
    set(state => ({
      language,
      interpretation:
        state.interpretation.status === 'ready'
          ? { ...state.interpretation, status: 'stale' }
          : state.interpretation,
    })),

  setAudience: audience => set({ audience }),

  beginSearch: location =>
    set({
      view: 'searched',
      location,
      coverage: lookupCoverage(location.coordinates),
      panelMode: 'data',
      panelDepth: 'list',
      selectedDataset: null,
      results: {},
      interpretation: idleInterpretation,
    }),

  goHome: () =>
    set({
      view: 'entry',
      location: null,
      coverage: null,
      panelMode: 'data',
      panelDepth: 'list',
      selectedDataset: null,
      primaryLayer: null,
      results: {},
      interpretation: idleInterpretation,
    }),

  setResult: (id, result) =>
    set(state => ({ results: { ...state.results, [id]: result } })),

  selectDataset: id => {
    const def = getDataset(id)
    set({
      selectedDataset: id,
      panelDepth: 'detail',
      panelMode: 'data',
      ...(def.mapRole === 'primary' ? { primaryLayer: id } : {}),
    })
  },

  backToList: () => set({ panelDepth: 'list', selectedDataset: null }),

  openDataMode: () => {
    const { selectedDataset } = get()
    set({ panelMode: 'data', panelDepth: selectedDataset ? 'detail' : 'list' })
  },

  openAiMode: () => set({ panelMode: 'ai', panelDepth: 'interpretation' }),

  setPrimaryLayer: id => {
    if (id !== null && getDataset(id).mapRole !== 'primary') return
    set({ primaryLayer: id })
  },

  toggleContextLayer: id => {
    if (getDataset(id).mapRole !== 'context') return
    set(state => {
      if (state.contextLayers.includes(id)) {
        return { contextLayers: state.contextLayers.filter(x => x !== id) }
      }
      if (state.contextLayers.length >= MAX_CONTEXT_LAYERS) return state
      return { contextLayers: [...state.contextLayers, id] }
    })
  },

  setInterpretation: partial =>
    set(state => ({ interpretation: { ...state.interpretation, ...partial } })),
}))
