import type { Audience, DatasetId, PanelMode } from '../types/workspace'
import { ALL_DATASET_IDS } from '../types/workspace'

export interface RouteState {
  q?: string
  lat?: number
  lng?: number
  aud?: Audience
  ds?: DatasetId
  mode?: PanelMode
}

const AUDIENCES: Audience[] = ['resident_owner', 'buyer_investor']

export function parseRoute(search: string): RouteState {
  const p = new URLSearchParams(search)
  const out: RouteState = {}
  const lat = Number(p.get('lat'))
  const lng = Number(p.get('lng'))
  if (p.has('lat') && p.has('lng') && Number.isFinite(lat) && Number.isFinite(lng)) {
    out.lat = lat
    out.lng = lng
    const q = p.get('q')
    if (q) out.q = q
  }
  const aud = p.get('aud')
  if (aud && AUDIENCES.includes(aud as Audience)) out.aud = aud as Audience
  const ds = p.get('ds')
  if (ds && ALL_DATASET_IDS.includes(ds as DatasetId)) out.ds = ds as DatasetId
  const mode = p.get('mode')
  if (mode === 'data' || mode === 'ai') out.mode = mode
  return out
}

export function serializeRoute(state: RouteState): string {
  const p = new URLSearchParams()
  if (state.lat !== undefined && state.lng !== undefined) {
    if (state.q) p.set('q', state.q)
    p.set('lat', String(state.lat))
    p.set('lng', String(state.lng))
  }
  if (state.aud) p.set('aud', state.aud)
  if (state.ds) p.set('ds', state.ds)
  if (state.mode) p.set('mode', state.mode)
  const s = p.toString()
  return s ? `?${s}` : ''
}
