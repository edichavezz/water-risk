export type Audience = 'resident_owner' | 'buyer_investor'

export type DatasetId =
  | 'flood'
  | 'drought'
  | 'reservoirs'
  | 'waterQuality'
  | 'coastalFlood'
  | 'groundwater'
  | 'bathingWater'

export const ALL_DATASET_IDS: DatasetId[] = [
  'flood', 'drought', 'reservoirs', 'waterQuality',
  'coastalFlood', 'groundwater', 'bathingWater',
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
export type PanelMode = 'data' | 'ai'
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
  language?: 'en' | 'es'
}
