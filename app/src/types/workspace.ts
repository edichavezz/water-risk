import type { Language } from './index'

export type Audience = 'resident_owner' | 'buyer_investor'

/**
 * Which threat a dataset speaks to. Orthogonal to `category`, which says what
 * kind of fact it is — `fireDanger` is hazard 'fire', category 'hazard', while
 * `reservoirs` is hazard 'water', category 'supply'.
 */
export type HazardFamily = 'water' | 'fire'

export type DatasetId =
  | 'flood'
  | 'drought'
  | 'reservoirs'
  | 'waterQuality'
  | 'coastalFlood'
  | 'groundwater'
  | 'bathingWater'
  | 'fireDanger'
  | 'fireHistory'
  | 'firePrevention'
  | 'waterRestrictions'

export const ALL_DATASET_IDS: DatasetId[] = [
  'flood', 'drought', 'reservoirs', 'waterQuality',
  'coastalFlood', 'groundwater', 'bathingWater',
  'fireDanger', 'fireHistory', 'firePrevention',
  'waterRestrictions',
]

export type DatasetStatus =
  | 'loading'
  | 'available'
  | 'unavailable'
  | 'not_applicable'
  | 'unsupported'
  | 'error'

export interface DatasetResult<T = unknown> {
  status: DatasetStatus
  data?: T
  error?: string
}

// Statuses that must NEVER be styled as safe/low-risk (spec §9.2).
export const NON_SAFE_STATUSES: DatasetStatus[] = ['unavailable', 'unsupported', 'error']

export function isRenderableValue(r: DatasetResult | undefined): boolean {
  return r?.status === 'available'
}

export type WorkspaceView = 'entry' | 'searched'
/* 'news' is a mode with no data behind it yet: the tab and its shell ship now
   so the three-tab layout is real, but the live pull is a separate task. */
export type PanelMode = 'data' | 'ai' | 'news'
export type PanelDepth = 'list' | 'detail' | 'interpretation'

export type InterpretationScope =
  | { type: 'location' }
  | { type: 'dataset'; id: DatasetId }

export interface InterpretationState {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'stale'
  scope: InterpretationScope | null
  text?: string
  questions?: string[]
  basis?: DatasetId[]
  // The language the text was generated in, so a language switch can mark it
  // stale. Follows `Language` rather than restating it — a seventh bundle
  // should not need an edit here. Type-only, so the barrel cycle is erased.
  language?: Language
  // Why a ready text went stale, so the banner can name the actual reason.
  staleReason?: 'language' | 'audience'
}
