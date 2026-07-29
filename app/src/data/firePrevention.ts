import type { FirePreventionResult } from '../types'
import type { PlaceContext } from '../types/place'

/**
 * Wildfire prevention plans, hand-curated and keyed by ISO 3166-2 region.
 *
 * This is a link table on purpose. Nothing in this space is machine-readable:
 * Spain's plans are per autonomous community, France's PPFCI are prefectural,
 * Italy's piani AIB are regional PDFs, and there is no aggregator for any of
 * them. A curated table with a visible "last checked" date is more honest than
 * a scraper that silently rots, and it is genuinely useful — knowing your
 * region has a named plan, and where to read it, is the answer.
 *
 * `checkedAt` is rendered to the reader. Government URLs move; saying when we
 * last looked is better than implying the link is live today.
 */
interface PreventionPlan {
  /** ISO 3166-2 level-4 code. */
  region: string
  regionName: string
  planName: string
  url: string
  checkedAt: string
  source: string
}

const PLANS: PreventionPlan[] = [
  {
    region: 'ES-AN',
    regionName: 'Andalucía',
    planName: 'Plan INFOCA',
    url: 'https://www.juntadeandalucia.es/medioambiente/portal/areas-tematicas/medio-forestal/incendios-forestales',
    checkedAt: '2026-07-29',
    source: 'Junta de Andalucía',
  },
  {
    region: 'ES-CL',
    regionName: 'Castilla y León',
    planName: 'Plan INFOCAL',
    url: 'https://medioambiente.jcyl.es/web/es/medio-natural/incendios-forestales.html',
    checkedAt: '2026-07-29',
    source: 'Junta de Castilla y León',
  },
  {
    region: 'ES-GA',
    regionName: 'Galicia',
    planName: 'Plan PLADIGA',
    url: 'https://mediorural.xunta.gal/es/temas/forestal/incendios-forestales',
    checkedAt: '2026-07-29',
    source: 'Xunta de Galicia',
  },
  {
    region: 'ES-VC',
    regionName: 'Comunitat Valenciana',
    planName: 'Plan Especial frente al Riesgo de Incendios Forestales',
    url: 'https://www.112cv.gva.es/es/incendios-forestales',
    checkedAt: '2026-07-29',
    source: 'Generalitat Valenciana',
  },
  {
    region: 'ES-CT',
    regionName: 'Catalunya',
    planName: 'INFOCAT',
    url: 'https://interior.gencat.cat/ca/arees_dactuacio/proteccio_civil/plans_de_proteccio_civil/plans_de_proteccio_civil_a_catalunya/infocat/',
    checkedAt: '2026-07-29',
    source: 'Generalitat de Catalunya',
  },
  {
    region: 'ES-MC',
    regionName: 'Región de Murcia',
    planName: 'Plan INFOMUR',
    url: 'https://www.112rm.com/dgsce/planes/infomur/',
    checkedAt: '2026-07-29',
    source: 'Región de Murcia',
  },
  {
    region: 'FR-PAC',
    regionName: "Provence-Alpes-Côte d'Azur",
    planName: 'Protection des forêts contre les incendies (PPFCI)',
    url: 'https://www.paca.developpement-durable.gouv.fr/protection-de-la-foret-contre-les-incendies-r2115.html',
    checkedAt: '2026-07-29',
    source: 'DREAL PACA',
  },
  {
    region: 'FR-OCC',
    regionName: 'Occitanie',
    planName: 'Défense des forêts contre les incendies (DFCI)',
    url: 'https://www.occitanie.developpement-durable.gouv.fr/',
    checkedAt: '2026-07-29',
    source: 'DREAL Occitanie',
  },
  {
    region: 'FR-COR',
    regionName: 'Corse',
    planName: 'PPFENI — plan de protection des forêts et des espaces naturels',
    url: 'https://www.corse.developpement-durable.gouv.fr/',
    checkedAt: '2026-07-29',
    source: 'DREAL Corse',
  },
  {
    region: 'IT-82',
    regionName: 'Sicilia',
    planName: 'Piano regionale antincendio boschivo (AIB)',
    url: 'https://www.regione.sicilia.it/istituzioni/regione/strutture-regionali/assessorato-agricoltura-sviluppo-rurale-pesca-mediterranea/dipartimento-sviluppo-rurale-territoriale',
    checkedAt: '2026-07-29',
    source: 'Regione Siciliana',
  },
  {
    region: 'IT-88',
    regionName: 'Sardegna',
    planName: 'Prescrizioni regionali antincendio',
    url: 'https://www.regione.sardegna.it/argomenti/ambiente-territorio/protezione-civile',
    checkedAt: '2026-07-29',
    source: 'Regione Sardegna',
  },
  {
    region: 'IT-62',
    regionName: 'Lazio',
    planName: 'Piano regionale antincendio boschivo (AIB)',
    url: 'https://www.regione.lazio.it/enti-locali/protezione-civile',
    checkedAt: '2026-07-29',
    source: 'Regione Lazio',
  },
  {
    region: 'IT-52',
    regionName: 'Toscana',
    planName: 'Piano operativo antincendi boschivi',
    url: 'https://www.regione.toscana.it/antincendi-boschivi',
    checkedAt: '2026-07-29',
    source: 'Regione Toscana',
  },
]

export function getPreventionPlan(place: PlaceContext): FirePreventionResult | null {
  const plan = place.region ? PLANS.find(p => p.region === place.region) : undefined
  if (!plan) return null
  return {
    regionName: plan.regionName,
    planName: plan.planName,
    url: plan.url,
    checkedAt: plan.checkedAt,
    source: plan.source,
  }
}

/** Regions we hold a plan for, so applicability does not have to guess. */
export const PREVENTION_REGIONS = new Set(PLANS.map(p => p.region))
