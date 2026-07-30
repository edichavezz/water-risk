import { create } from 'zustand'
import type { Language } from '../types'
import type { PlaceContext } from '../types/place'
import type {
  Audience, DatasetId, DatasetResult, InterpretationState,
  PanelDepth, PanelMode, WorkspaceView,
} from '../types/workspace'
import { coverageProfile, type CoverageProfile } from '../services/coverage'
import { getDataset } from '../registry/datasets'

const MAX_CONTEXT_LAYERS = 2

// Where a search came from. The camera flies to a fixed zoom for a typed
// query, but holds the user's own zoom when they picked the point themselves.
export type SearchOrigin = 'query' | 'map'

// Which top-level page the banner is showing. This is deliberately orthogonal
// to `view`: the map keeps its camera, its layers and any active search while
// About is on screen, so coming back lands exactly where the reader left.
export type Page = 'map' | 'about'

interface AppStore {
  language: Language
  page: Page
  view: WorkspaceView
  location: PlaceContext | null
  searchOrigin: SearchOrigin
  audience: Audience | null
  coverage: CoverageProfile | null
  panelMode: PanelMode
  panelDepth: PanelDepth
  selectedDataset: DatasetId | null
  primaryLayer: DatasetId | null
  contextLayers: DatasetId[]
  results: Partial<Record<DatasetId, DatasetResult>>
  interpretation: InterpretationState
  /* Bumped when something asks the entry field for focus (the About CTA).
     A counter rather than a boolean, so repeat requests still fire. */
  searchFocusNonce: number

  setLanguage: (lang: Language) => void
  setPage: (page: Page) => void
  goToSearch: () => void
  setAudience: (a: Audience | null) => void
  beginSearch: (location: PlaceContext, origin?: SearchOrigin) => void
  goHome: () => void
  setResult: (id: DatasetId, result: DatasetResult) => void
  selectDataset: (id: DatasetId) => void
  backToList: () => void
  openDataMode: () => void
  openAiMode: () => void
  openNewsMode: () => void
  setPrimaryLayer: (id: DatasetId | null) => void
  toggleContextLayer: (id: DatasetId) => void
  setInterpretation: (partial: Partial<InterpretationState>) => void
}

const idleInterpretation: InterpretationState = { status: 'idle', scope: null }

export const useAppStore = create<AppStore>((set, get) => ({
  language: 'en',
  page: 'map',
  view: 'entry',
  location: null,
  searchOrigin: 'query',
  audience: null,
  coverage: null,
  panelMode: 'data',
  panelDepth: 'list',
  selectedDataset: null,
  primaryLayer: null,
  contextLayers: ['reservoirs'],
  results: {},
  interpretation: idleInterpretation,
  searchFocusNonce: 0,

  setLanguage: language =>
    set(state => ({
      language,
      interpretation:
        state.interpretation.status === 'ready'
          ? { ...state.interpretation, status: 'stale', staleReason: 'language' }
          : state.interpretation,
    })),

  // Page is orthogonal to `view`: switching to About paints over the map but
  // leaves the camera, the layers and any active search exactly as they were.
  setPage: page => set({ page }),

  // The About page's call to action. It returns to the map and — only when no
  // search is already open — asks the entry field for the cursor, so "try it
  // out" lands the reader ready to type instead of clearing their work.
  goToSearch: () =>
    set(state => ({
      page: 'map',
      searchFocusNonce:
        state.view === 'entry' ? state.searchFocusNonce + 1 : state.searchFocusNonce,
    })),

  // Audience changes the framing of an interpretation, not the data behind it.
  // Nothing refetches; a ready text goes stale so the reader is never shown
  // buyer-framed prose under a resident selection (same rule as language).
  setAudience: audience =>
    set(state => ({
      audience,
      interpretation:
        state.interpretation.status === 'ready'
          ? { ...state.interpretation, status: 'stale', staleReason: 'audience' }
          : state.interpretation,
    })),

  beginSearch: (location, origin = 'query') =>
    set({
      view: 'searched',
      location,
      searchOrigin: origin,
      coverage: coverageProfile(location),
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
      searchOrigin: 'query',
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

  // Depth is left alone: news is a mode, and coming back to Public data should
  // land on whatever the reader had open.
  openNewsMode: () => set({ panelMode: 'news' }),

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
