import type { PlaceContext } from '../types/place'
import type { Audience, DatasetId, DatasetResult, HazardFamily } from '../types/workspace'
import { getFloodZoneStatus } from '../services/floodZone'
import { getDroughtStatus } from '../services/drought'
import { getSupplyForLocation } from '../services/supply'
import { getWaterQualityByMunicipality } from '../services/waterQuality'
import { isCoastal } from '../services/coastline'
import { getCoastalZoning } from '../services/coastalZoning'
import { getGroundwaterStatus } from '../services/groundwater'
import { getNearestBathingSite } from '../services/bathingWater'
import { getFireDanger } from '../services/fireDanger'
import { getRecentFireDetections } from '../services/activeFires'
import { getFireHistory } from '../services/fireHistory'
import { getPreventionPlan, PREVENTION_REGIONS } from '../data/firePrevention'
import { getWaterRestrictions } from '../services/waterRestrictions'

/**
 * Whether this dataset can say anything here.
 *
 * `unsupported` is the expansion default and the honesty rule lives in the gap
 * between it and `not_applicable`. `not_applicable` is filtered out of the list
 * AND out of AI evidence, and is deliberately absent from NON_SAFE_STATUSES —
 * it means the question does not arise here. `unsupported` stays visible, is a
 * NON_SAFE status, and reaches the model as an explicit gap.
 *
 * Almost every gap outside Andalucía is the second kind: river flood risk is
 * real in Calabria, we simply have no SNCZI there. Calling that
 * `not_applicable` would delete the row, hide the gap from the AI, and let
 * absence read as absence of risk. Guarded by applicability.test.ts.
 */
export type Applicability = 'covered' | 'unsupported' | 'not_applicable'

export interface DatasetDef {
  id: DatasetId
  hazard: HazardFamily
  category: 'hazard' | 'supply' | 'quality'
  source: { name: string; url?: string }
  mapRole: 'primary' | 'context' | 'none'
  // Set when the dataset has a map role but its upstream WMS is down, so the
  // layer cannot paint. The tray shows the control disabled rather than
  // offering a toggle that silently does nothing.
  mapUnavailable?: boolean
  aiAllowed: boolean
  audienceWeight: Record<Audience, number>
  defaultOrder: number
  /**
   * Renamed from `appliesTo`, and the rename is load-bearing: had the boolean
   * field kept its name, `DATASETS.filter(d => d.appliesTo(loc))` would still
   * compile and every 'unsupported' string would be truthy, silently restoring
   * the old behaviour with the wrong meaning.
   */
  applicability: (place: PlaceContext) => Applicability
  fetch: (place: PlaceContext) => Promise<DatasetResult>
}

function ok<T>(data: T): DatasetResult<T> {
  return { status: 'available', data }
}
function err(e: unknown): DatasetResult {
  return { status: 'error', error: e instanceof Error ? e.message : String(e) }
}

export const DATASETS: DatasetDef[] = [
  {
    id: 'flood',
    hazard: 'water',
    category: 'hazard',
    source: { name: 'SNCZI — MITERD', url: 'https://sig.mapama.gob.es/snczi/' },
    mapRole: 'primary',
    aiAllowed: true,
    audienceWeight: { resident_owner: 3, buyer_investor: 1 },
    defaultOrder: 1,
    // SNCZI maps Spain. Flood risk is just as real elsewhere, so everywhere
    // else is 'unsupported' — a visible gap — not 'not_applicable'.
    applicability: p => (p.countryCode === 'es' ? 'covered' : 'unsupported'),
    fetch: async loc => {
      try { return ok(await getFloodZoneStatus(loc.coordinates)) } catch (e) { return err(e) }
    },
  },
  {
    id: 'drought',
    hazard: 'water',
    category: 'hazard',
    source: {
      name: 'Copernicus EDO',
      url: 'https://drought.emergency.copernicus.eu/',
    },
    mapRole: 'primary',
    aiAllowed: true,
    audienceWeight: { resident_owner: 1, buyer_investor: 4 },
    defaultOrder: 2,
    // Copernicus EDO covers the whole continent, and the pixel sample already
    // returns 'unknown' -> unavailable outside its footprint. This is the one
    // dataset that made pan-Mediterranean credible on day one.
    applicability: () => 'covered',
    fetch: async loc => {
      try {
        const d = await getDroughtStatus(loc.coordinates)
        return d.level === 'unknown' ? { status: 'unavailable' } : ok(d)
      } catch (e) { return err(e) }
    },
  },
  {
    id: 'reservoirs',
    hazard: 'water',
    category: 'supply',
    source: { name: 'REDIAM / MITERD' },
    mapRole: 'context',
    aiAllowed: true,
    audienceWeight: { resident_owner: 2, buyer_investor: 5 },
    defaultOrder: 3,
    // Every inhabited place has a water supply, so this is never
    // 'not_applicable'. Spain answers from curated supply systems, France from
    // the national drinking-water register; elsewhere the question is real and
    // unanswered, which is `unsupported`.
    applicability: p =>
      p.countryCode === 'es' || p.countryCode === 'fr' ? 'covered' : 'unsupported',
    fetch: async loc => {
      try {
        const supply = await getSupplyForLocation(loc)
        return supply.provenance === 'none' ? { status: 'unavailable' } : ok(supply)
      } catch (e) { return err(e) }
    },
  },
  {
    id: 'waterQuality',
    hazard: 'water',
    category: 'quality',
    source: { name: 'SINAC — Ministerio de Sanidad', url: 'https://sinac.sanidad.gob.es/' },
    mapRole: 'none',
    aiAllowed: true,
    audienceWeight: { resident_owner: 4, buyer_investor: 6 },
    defaultOrder: 4,
    // SINAC is the Spanish register. Without a municipality there is nothing to
    // look up anywhere — open sea, unmapped ground — which is the one genuinely
    // not-applicable case.
    applicability: p =>
      !p.municipality ? 'not_applicable' : p.countryCode === 'es' ? 'covered' : 'unsupported',
    fetch: async loc => {
      try {
        const q = await getWaterQualityByMunicipality(loc.municipality ?? '')
        return q === null ? { status: 'unavailable' } : ok(q)
      } catch (e) { return err(e) }
    },
  },
  {
    id: 'coastalFlood',
    hazard: 'water',
    category: 'hazard',
    // The map layer is REDIAM's Andalucía zoning; the point verdict would come
    // from MITERD DPH, which is down. The legend sits with the map, so it
    // names what is actually drawn.
    source: { name: 'REDIAM (Andalucía)' },
    mapRole: 'primary',
    aiAllowed: true,
    audienceWeight: { resident_owner: 6, buyer_investor: 2 },
    defaultOrder: 5,
    // Inland, the coast genuinely does not arise. On a coast we do not map,
    // it does — so that stays visible rather than vanishing.
    applicability: p =>
      !isCoastal(p.coordinates)
        ? 'not_applicable'
        : p.countryCode === 'es'
          ? 'covered'
          : 'unsupported',
    // The national deslinde that would answer "is this plot inside the strip"
    // is down, so the card reports the zoning in force around the point
    // instead. A thrown error stays an error.
    //
    // A `null` — no zoning within ~3 km — is `not_applicable`, not
    // `unavailable`. Inland towns that slip past the coastal test used to draw
    // a coastal card that then reported "no data", while `ai.ts` told the model
    // "No usable value". The query result is the real coastal test, so a miss
    // retires the card instead — `isApplicableHere` drops the row and
    // `buildEvidence` skips it.
    fetch: async loc => {
      try {
        const z = await getCoastalZoning(loc.coordinates)
        return z === null ? { status: 'not_applicable' } : ok(z)
      } catch (e) { return err(e) }
    },
  },
  {
    id: 'groundwater',
    hazard: 'water',
    category: 'hazard',
    source: { name: 'IGME' },
    // No map layer left to draw: the geometry behind it was fabricated and has
    // been removed, and MITECO's service that publishes the real units is down.
    mapRole: 'none',
    aiAllowed: true,
    audienceWeight: { resident_owner: 5, buyer_investor: 3 },
    defaultOrder: 6,
    // `unsupported` everywhere, including Spain: IGME's hydrogeological units
    // are Spanish, but no live service publishes them (see
    // services/groundwater.ts), so `covered` would have the coverage box
    // promise a check that cannot run. Restore the country test when a real
    // source is wired up.
    applicability: () => 'unsupported',
    fetch: async loc => {
      try {
        const g = getGroundwaterStatus(loc.coordinates)
        return g === null ? { status: 'unavailable' } : ok(g)
      } catch (e) { return err(e) }
    },
  },
  {
    id: 'bathingWater',
    hazard: 'water',
    category: 'quality',
    source: { name: 'EEA Bathing Water' },
    mapRole: 'none',
    aiAllowed: true,
    audienceWeight: { resident_owner: 7, buyer_investor: 7 },
    defaultOrder: 7,
    // The EEA register is EU-wide, so fixing the coastal test is all this
    // needed to start working in France and Italy.
    applicability: p => (isCoastal(p.coordinates) ? 'covered' : 'not_applicable'),
    // No site within 5 km is the same shape of answer as the coastal zoning
    // miss above: the distance check is the honest one. Retire the card rather
    // than report "no data" about beaches to somebody in the Sierra de Huelva.
    fetch: async loc => {
      try {
        const s = await getNearestBathingSite(loc.coordinates)
        return s === null ? { status: 'not_applicable' } : ok(s)
      } catch (e) { return err(e) }
    },
  },
  {
    id: 'waterRestrictions',
    hazard: 'water',
    category: 'hazard',
    source: { name: 'VigiEau — Ministère de la Transition écologique', url: 'https://vigieau.gouv.fr/' },
    mapRole: 'none',
    aiAllowed: true,
    // The one legally binding reading in the app, so it leads for a resident.
    audienceWeight: { resident_owner: 1, buyer_investor: 3 },
    defaultOrder: 2,
    // VigiEau covers France only. Spain publishes restrictions per
    // confederación with no common feed, and Italy per region — both real
    // questions we cannot yet answer, so `unsupported` rather than hidden.
    applicability: p => (p.countryCode === 'fr' ? 'covered' : 'unsupported'),
    fetch: async p => {
      try {
        const r = await getWaterRestrictions(p.coordinates)
        return r === null ? { status: 'unavailable' } : ok(r)
      } catch (e) { return err(e) }
    },
  },
  {
    id: 'fireDanger',
    hazard: 'fire',
    category: 'hazard',
    source: {
      name: 'Copernicus EFFIS',
      url: 'https://forest-fire.emergency.copernicus.eu/',
    },
    mapRole: 'primary',
    aiAllowed: true,
    audienceWeight: { resident_owner: 1, buyer_investor: 2 },
    defaultOrder: 8,
    // ECMWF-driven and continental: the one fire dataset that works anywhere
    // the app answers.
    applicability: () => 'covered',
    fetch: async p => {
      try {
        const d = await getFireDanger(p.coordinates)
        return d.danger === 'unknown' ? { status: 'unavailable' } : ok(d)
      } catch (e) { return err(e) }
    },
  },
  {
    id: 'activeFire',
    hazard: 'fire',
    category: 'hazard',
    source: {
      name: 'NASA FIRMS — NOAA-20 VIIRS',
      url: 'https://firms.modaps.eosdis.nasa.gov/',
    },
    mapRole: 'context',
    aiAllowed: true,
    audienceWeight: { resident_owner: 1, buyer_investor: 1 },
    defaultOrder: 9,
    applicability: () => 'covered',
    fetch: async p => {
      try { return ok(await getRecentFireDetections(p.coordinates)) } catch (e) { return err(e) }
    },
  },
  {
    id: 'fireHistory',
    hazard: 'fire',
    category: 'hazard',
    source: {
      name: 'Copernicus EFFIS burnt areas',
      url: 'https://forest-fire.emergency.copernicus.eu/',
    },
    mapRole: 'context',
    aiAllowed: true,
    audienceWeight: { resident_owner: 2, buyer_investor: 1 },
    defaultOrder: 10,
    applicability: () => 'covered',
    fetch: async p => {
      try {
        // An empty archive is a real answer here — "nothing has burned within
        // 30 km since 2012" is information, not a missing reading — so this
        // stays `available` with an empty list rather than going `unavailable`.
        return ok(await getFireHistory(p.coordinates))
      } catch (e) { return err(e) }
    },
  },
  {
    id: 'firePrevention',
    hazard: 'fire',
    category: 'quality',
    source: { name: 'Regional forest authorities' },
    mapRole: 'none',
    // Curated links, not a reading. There is nothing here for the model to
    // interpret and a plan's existence says nothing about risk at this point.
    aiAllowed: false,
    audienceWeight: { resident_owner: 8, buyer_investor: 8 },
    defaultOrder: 11,
    applicability: p =>
      p.region && PREVENTION_REGIONS.has(p.region) ? 'covered' : 'unsupported',
    fetch: async p => {
      try {
        const plan = getPreventionPlan(p)
        return plan === null ? { status: 'unavailable' } : ok(plan)
      } catch (e) { return err(e) }
    },
  },
]

export function getDataset(id: DatasetId): DatasetDef {
  const d = DATASETS.find(x => x.id === id)
  if (!d) throw new Error(`Unknown dataset: ${id}`)
  return d
}

/**
 * Registry order for a place. Deliberately unfiltered: the orchestrator needs
 * every dataset so it can record why each one has no result, and the list needs
 * those records before it can decide what to hide.
 */
export function orderedDatasets(_place: PlaceContext, audience: Audience | null): DatasetDef[] {
  return [...DATASETS]
    .sort((a, b) =>
      audience
        ? a.audienceWeight[audience] - b.audienceWeight[audience]
        : a.defaultOrder - b.defaultOrder
    )
}
