import type { HazardFamily } from '../types/workspace'

/**
 * The words that make a headline about water or fire, per publishing language.
 *
 * One table serves two jobs, which is why they live together: the terms are
 * OR'd into the GDELT query, and the same terms classify a returned title into
 * its Fire or Water pill. If the two lists ever drifted apart we would fetch on
 * one vocabulary and label on another.
 *
 * Kept deliberately short. GDELT's query string has a practical complexity
 * limit, and every extra near-synonym buys less coverage than it costs in
 * false positives — "fuego" already carries most of what "llamas" would add.
 */
export interface KeywordSet {
  fire: string[]
  water: string[]
}

const EN: KeywordSet = {
  fire: ['wildfire', '"forest fire"'],
  water: ['drought', 'reservoir', 'flood'],
}

const BY_LANGUAGE: Record<string, KeywordSet> = {
  es: {
    fire: ['incendio', '"incendio forestal"', 'fuego'],
    water: ['sequía', 'embalse', 'pantano', 'inundación', '"restricciones de agua"'],
  },
  fr: {
    fire: ['incendie', '"feu de forêt"'],
    water: ['sécheresse', 'barrage', 'inondation', '"restrictions d\'eau"'],
  },
  it: {
    fire: ['incendio', '"incendio boschivo"', 'rogo'],
    water: ['siccità', 'invaso', 'diga', 'alluvione'],
  },
  pt: {
    fire: ['incêndio', '"incêndio florestal"'],
    water: ['seca', 'albufeira', 'barragem', 'cheia'],
  },
  el: {
    fire: ['πυρκαγιά', 'φωτιά'],
    water: ['ξηρασία', 'ταμιευτήρας', 'πλημμύρα'],
  },
  hr: {
    fire: ['požar'],
    water: ['suša', 'akumulacija', 'poplava'],
  },
}

/** The publishing language we expect for a country's own press. */
const LANGUAGE_BY_COUNTRY: Record<string, string> = {
  es: 'es', fr: 'fr', it: 'it', pt: 'pt', gr: 'el', cy: 'el',
  hr: 'hr', si: 'hr', mt: 'en',
}

/**
 * GDELT wants a country *name*, not an ISO code — `sourcecountry:france`.
 * A place outside this list still gets a query, just an unrestricted one, and
 * the caller widens nothing to compensate.
 */
const SOURCE_COUNTRY: Record<string, string> = {
  es: 'spain', fr: 'france', it: 'italy', pt: 'portugal', gr: 'greece',
  hr: 'croatia', si: 'slovenia', mt: 'malta', cy: 'cyprus',
}

export function sourceCountryFor(countryCode?: string): string | null {
  return SOURCE_COUNTRY[countryCode?.toLowerCase() ?? ''] ?? null
}

/**
 * The local vocabulary plus English, always.
 *
 * English is not a fallback here — it is how a national outlet's English
 * edition, and the wire copy republished in-country, still surface. Dropping it
 * would quietly hide coverage that `sourcecountry` has already vouched for.
 */
export function keywordsFor(countryCode?: string): KeywordSet {
  const local = BY_LANGUAGE[LANGUAGE_BY_COUNTRY[countryCode?.toLowerCase() ?? ''] ?? '']
  if (!local) return EN
  return {
    fire: [...local.fire, ...EN.fire],
    water: [...local.water, ...EN.water],
  }
}

/** Every term, flattened — what the query needs. */
export function allKeywords(countryCode?: string): string[] {
  const set = keywordsFor(countryCode)
  return [...set.fire, ...set.water]
}

/**
 * Which hazard a title is about, or null when nothing matched.
 *
 * Fire is tested first: a headline naming both ("fire near the reservoir") is
 * far more often a fire story with water context than the reverse.
 */
export function classifyTitle(title: string, countryCode?: string): HazardFamily | null {
  const set = keywordsFor(countryCode)
  const haystack = fold(title)
  const hit = (terms: string[]) =>
    terms.some(term => haystack.includes(fold(term.replace(/"/g, ''))))
  if (hit(set.fire)) return 'fire'
  if (hit(set.water)) return 'water'
  return null
}

/** Lower-cased and unaccented, so `sequía` matches a headline written `SEQUIA`. */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
