import type { Coordinates, GroundwaterResult } from '../types'

/**
 * Overexploited groundwater units — currently unsourceable.
 *
 * NOTE (verified 2026-07): this returned an answer for every point in Spain,
 * and the answer was fabricated. The bundled `groundwater-units.json` held four
 * "units", each a five-point rectangle rather than a real boundary, and three
 * of the four (Alto Guadalentín, Vega Media y Baja del Segura, Medio Vinalopó)
 * sit in Murcia and Alicante — outside this app's declared coverage. Only one
 * crude box fell inside Andalucía at all.
 *
 * The consequence was worse than a missing card. Outside those boxes the
 * service reported `inOverexploitedUnit: false` with status `available`, which
 * the panel showed as a result and `ai.ts` handed the model as "Not inside a
 * declared overexploited hydrogeological unit (source IGME)" — a sourced,
 * confident claim about groundwater at a point where nothing had been checked.
 * Inside them, the corners produced equally fabricated positives, and the map
 * drew the rectangles as though they were IGME boundaries.
 *
 * Real geometry could not be obtained. MITECO's national gateway
 * (wms.mapama.gob.es), which publishes the masas de agua subterránea, answers
 * every request — GetCapabilities included — with a server-side
 * NullReferenceException; it is the same outage already documented in
 * `coastalFlood.ts` for the coastal deslinde. REDIAM publishes no equivalent
 * layer (`REDIAM_Masas_Agua_Subterranea` returns "Unable to access file"), and
 * IDEE's hidrografía service carries surface water bodies only, not groundwater
 * status.
 *
 * A caution for whoever restores this: the WFD "masa de agua subterránea en mal
 * estado cuantitativo" assessments are *not* the same thing as a legally
 * declared overexploited unit. Swapping one in under this label would rebuild
 * the same defect in a new form — the label, `source.name` and the `ai.ts`
 * evidence sentence all have to change together with the data.
 *
 * Until then the honest state is no answer, so this returns null and the
 * dataset reports unavailable rather than something reassuring.
 */
export function getGroundwaterStatus(_coords: Coordinates): GroundwaterResult | null {
  return null
}
