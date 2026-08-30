import type { Reservoir } from './index'

/**
 * How we know who supplies a place. Ordered strongest to weakest.
 *
 * This exists because the honest answer differs by country and the difference
 * matters to the reader. Research settled what is obtainable: the
 * municipality → supply system edge is broadly available (SINAC nationally in
 * Spain, Hub'Eau nationally in France, both keyless), while the
 * system → source reservoir edge is not, outside hand curation.
 *
 * So provenance travels with the answer and the copy changes with it. A
 * registry tier must never borrow a curated tier's phrasing, and a basin tier
 * must never borrow either.
 */
export type SupplyProvenance =
  /** Hand-researched from the operator's own publications. Names real reservoirs. */
  | 'curated'
  /** Read from a government registry. Names a network, usually not its reservoirs. */
  | 'official-registry'
  /** No supply relationship known; reservoirs in the same river-basin district. */
  | 'basin'
  /** Nothing known. */
  | 'none'

/** A named distribution network, where a registry gives one but no reservoir. */
export interface SupplyNetwork {
  code: string
  name: string
}

export interface SupplyAnswer {
  provenance: SupplyProvenance
  /** The supply system or operator, when one is known. */
  systemName?: string
  /** Distribution networks from a registry tier. Empty for other tiers. */
  networks: SupplyNetwork[]
  /**
   * Reservoirs behind the supply. Only ever populated for `curated`, and for
   * `basin` — where they are basin context and must not be described as supply.
   */
  reservoirs: Reservoir[]
  source: { name: string; url?: string }
}

export const NO_SUPPLY: SupplyAnswer = {
  provenance: 'none',
  networks: [],
  reservoirs: [],
  source: { name: '' },
}
