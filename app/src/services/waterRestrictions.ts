import type { Coordinates, WaterRestrictionResult, RestrictionLevel, RestrictionZone } from '../types'

/**
 * French drought restrictions in force at a point, from VigiEau.
 *
 * This is the cleanest "water risk here" primitive in the whole app: one
 * keyless, CORS-open call takes a lat/lon and returns the *legally binding*
 * restriction level, the prefectural decree behind it and the uses it limits.
 * Everything else the app shows is an indicator to be interpreted; this is the
 * rule you actually have to follow.
 *
 * Propluvia, the source usually cited for this, was decommissioned in May 2024.
 * VigiEau is its live successor — do not build against Propluvia.
 */
const VIGIEAU_ZONES = 'https://api.vigieau.beta.gouv.fr/api/zones'

/**
 * Severity, weakest first. VigiEau returns these per resource type, so the
 * index doubles as the comparison key when picking the worst.
 */
const LEVELS: RestrictionLevel[] = ['vigilance', 'alerte', 'alerte_renforcee', 'crise']

/**
 * The three resources a decree restricts separately: surface water, groundwater
 * and the drinking-water network. A place can sit at `vigilance` for rivers and
 * `crise` for the tap, so they are reported individually as well as rolled up.
 */
const ZONE_TYPES: Record<string, RestrictionZone['resource']> = {
  SUP: 'surface',
  SOU: 'groundwater',
  AEP: 'drinking_water',
}

interface RawZone {
  nom?: string
  type?: string
  departement?: string
  niveauGravite?: string
  arrete?: {
    dateDebutValidite?: string
    dateFinValidite?: string
    cheminFichier?: string
  }
}

export function rankLevel(level: RestrictionLevel): number {
  return LEVELS.indexOf(level)
}

/**
 * Rolls the per-resource zones up into one answer.
 *
 * The headline is the *worst* level in force, never an average: a decree that
 * puts the drinking-water network into crisis is not softened by rivers being
 * merely under watch, and showing the mean of the two would understate a legal
 * restriction the reader is bound by.
 */
export function shapeRestrictions(raw: RawZone[]): WaterRestrictionResult | null {
  const zones: RestrictionZone[] = []

  for (const z of raw) {
    const resource = z.type ? ZONE_TYPES[z.type] : undefined
    const level = LEVELS.find(l => l === z.niveauGravite)
    if (!resource || !level) continue
    zones.push({ resource, level, zoneName: z.nom ?? '' })
  }

  if (zones.length === 0) return null

  const worst = zones.reduce((a, b) => (rankLevel(b.level) > rankLevel(a.level) ? b : a))
  // Every zone in a response shares one decree, so the first with an arrêté is
  // representative.
  const decree = raw.find(z => z.arrete?.cheminFichier)?.arrete

  return {
    level: worst.level,
    zoneName: worst.zoneName,
    department: raw.find(z => z.departement)?.departement,
    zones,
    decreeUrl: decree?.cheminFichier,
    validFrom: decree?.dateDebutValidite,
    validTo: decree?.dateFinValidite,
    source: 'VigiEau',
  }
}

/**
 * Returns null when no restriction zone covers the point — which is a real
 * answer ("nothing in force here"), not a failure. A thrown error stays an
 * error so the row can offer a retry.
 */
export async function getWaterRestrictions(
  coords: Coordinates,
): Promise<WaterRestrictionResult | null> {
  const res = await fetch(`${VIGIEAU_ZONES}?lon=${coords.lng}&lat=${coords.lat}`)
  if (!res.ok) throw new Error(`VigiEau ${res.status}`)
  const data: RawZone[] = await res.json()
  return shapeRestrictions(Array.isArray(data) ? data : [])
}
