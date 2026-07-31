import type { HazardFamily } from './workspace'

/**
 * One headline that mentions this area.
 *
 * `hazard` is nullable on purpose. GDELT matches the article *body*, but the
 * response carries only the title, so a piece can legitimately match `sequía`
 * in paragraph four and give us no way to tell. An unclassified item shows no
 * pill rather than a guessed one.
 */
export interface NewsItem {
  title: string
  url: string
  domain: string
  /** Epoch milliseconds, parsed from GDELT's compact `seendate`. */
  seenAt: number
  language: string
  hazard: HazardFamily | null
  /** The title names the municipality itself, not just the province. */
  namesMunicipality: boolean
  /** The title names the province. */
  namesProvince: boolean
}

/** Which toponym ring produced the answer. */
export type NewsRing = 'municipality' | 'region'

/** Which time window the rendered items came from. */
export type NewsWindow = 'week' | 'month'

export interface NewsAnswer {
  items: NewsItem[]
  window: NewsWindow
  ring: NewsRing
}

/**
 * `unreachable` is deliberately distinct from an empty `ready`.
 *
 * A throttled GDELT answers with a plain-text notice and, on a 429, no CORS
 * header at all — from the browser that is indistinguishable from being
 * offline. Collapsing it into "no coverage found" would report silence as a
 * finding.
 */
export type NewsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; answer: NewsAnswer }
  | { status: 'unreachable' }
