import { create } from 'zustand'
import type { Language } from '../types'
import type { PlaceContext } from '../types/place'
import type {
  Audience, DatasetId, DatasetResult, InterpretationState,
  PanelDepth, PanelMode, WorkspaceView,
} from '../types/workspace'
import { coverageProfile, type CoverageProfile } from '../services/coverage'
import { getDataset } from '../registry/datasets'
import type { NewsAnswer, NewsState } from '../types/news'
import { getNewsForLocation, reserveNewsSlot } from '../services/news'

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
  news: NewsState
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
  loadNews: (force?: boolean) => Promise<void>
  setPrimaryLayer: (id: DatasetId | null) => void
  toggleContextLayer: (id: DatasetId) => void
  setInterpretation: (partial: Partial<InterpretationState>) => void
}

const idleInterpretation: InterpretationState = { status: 'idle', scope: null }

/**
 * Answers already fetched this session, keyed by place.
 *
 * Outside the store on purpose: it must survive `beginSearch` clearing the
 * state, so that going back to a place already looked at costs no request.
 * GDELT allows one every five seconds and throttles well inside that in
 * practice, so a reader flipping between the three tabs must never spend a
 * call they have already spent.
 */
const newsCache = new Map<string, NewsAnswer>()

const newsKey = (place: PlaceContext) =>
  `${place.countryCode ?? ''}|${place.municipality ?? place.displayName}`

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
  news: { status: 'idle' },
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
      news: { status: 'idle' },
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
      news: { status: 'idle' },
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
  //
  // No fetch here: `NewsFeed` asks for it when it mounts. Firing from this
  // action would miss the reader who arrives on a shared `?mode=news` link,
  // where the mode is restored from the route and this never runs.
  openNewsMode: () => set({ panelMode: 'news' }),

  loadNews: async (force = false) => {
    const { location, news } = get()
    if (!location) return
    if (news.status === 'loading') return
    if (!force && news.status === 'ready') return

    const key = newsKey(location)
    const cached = !force && newsCache.get(key)
    if (cached) {
      set({ news: { status: 'ready', answer: cached } })
      return
    }

    // Loading goes up *before* the wait, not after. It is what the reader has
    // asked for either way, and the `status === 'loading'` guard above is what
    // makes repeated Retry taps free instead of one request each.
    set({ news: { status: 'loading' } })
    try {
      const wait = reserveNewsSlot()
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
      // Panning between places queues one of these per place. Checking again
      // here means only the place the reader actually settled on spends its
      // slot; the ones passed through on the way drop out having sent nothing.
      if (!get().location || newsKey(get().location!) !== key) return

      const answer = await getNewsForLocation(location)
      newsCache.set(key, answer)
      // The reader may have moved on while the request was in flight; writing
      // a stale place's headlines under a new one would be a real error.
      if (get().location && newsKey(get().location!) === key) {
        set({ news: { status: 'ready', answer } })
      }
    } catch {
      // Throttled, offline, or unparseable — all the same to the reader, and
      // all of them mean "we don't know", never "there is no news".
      if (get().location && newsKey(get().location!) === key) {
        set({ news: { status: 'unreachable' } })
      }
    }
  },

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
