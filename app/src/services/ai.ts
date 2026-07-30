import type { Language } from '../types'
import type { DatasetId, DatasetResult, InterpretationScope } from '../types/workspace'
import { useAppStore } from '../store/useAppStore'
import type {
  FloodZoneResult, DroughtStatus, Reservoir, WaterQualityResult,
  CoastalZoning, GroundwaterResult, BathingWaterResult,
  FireDangerResult, FireHistoryResult, FirePreventionResult, WaterRestrictionResult,
} from '../types'

export interface EvidenceItem { id: DatasetId; status: string; summary: string }

function summarize(id: DatasetId, r: DatasetResult): string {
  if (r.status !== 'available') {
    // Evidence for non-values carries the state, never an implied value.
    return `No usable value (${r.status}).`
  }
  switch (id) {
    case 'flood': {
      const d = r.data as FloodZoneResult
      return d.inZone
        ? `Inside mapped flood zone, return period T${d.returnPeriod} (source SNCZI).`
        : 'Outside the mapped T10, T100 and T500 river-flood zones (source SNCZI).'
    }
    case 'drought': {
      const d = r.data as DroughtStatus
      return `Combined Drought Indicator level: ${d.level} (source Copernicus EDO, ${d.updatedAt}).`
    }
    case 'reservoirs': {
      const rs = r.data as Reservoir[]
      const asOf = rs[0]?.fillPercentAsOf
      const system = rs[0]?.systemName
      const scope = system ? `Reservoirs supplying this area via ${system}` : 'Supply reservoirs'
      // The averages are the context that makes a fill % interpretable, so the
      // model gets them too — omitted rather than guessed when unavailable.
      const level = (x: Reservoir) => {
        const vs = [
          x.mean5yr != null ? `5-yr avg ${x.mean5yr}%` : null,
          x.mean10yr != null ? `10-yr avg ${x.mean10yr}%` : null,
        ].filter(Boolean).join(', ')
        return `${x.name} ${x.fillPercent}% full${vs ? ` (${vs} for this date)` : ''}`
      }
      return `${scope}: ${rs.map(level).join('; ')} (source REDIAM${asOf ? `, levels read ${asOf}` : ''}).`
    }
    case 'waterQuality': {
      const d = r.data as WaterQualityResult
      return `SINAC ${d.year} drinking-water compliance: ${d.compliance}; source type ${d.sourceType}.`
    }
    case 'coastalFlood': {
      const d = r.data as CoastalZoning
      // Deliberately never an in/out verdict. This source gives the management
      // zoning around the point, not the legal deslinde, so the model is told
      // what is known and explicitly told what is not — otherwise it will
      // helpfully conclude "outside the strip", which we cannot support.
      const parts = [
        d.zoning ? `zoning class "${d.zoning}"` : null,
        d.sensitivity ? `DPMT sensitivity "${d.sensitivity}"` : null,
        d.location ? `stretch at ${d.location}` : null,
        d.profile ? `nearest surveyed profile ${d.profile}` : null,
      ].filter(Boolean).join('; ')
      return (
        `Coastal protection zoning (source REDIAM, Andalucía): ${parts || 'present but undescribed'}. ` +
        `This is the zoning in force around the point, NOT a determination of whether the property ` +
        `lies inside the servidumbre or policía strip — the national deslinde service is unavailable, ` +
        `so that question cannot be answered. Do not state or imply the property is inside or outside a strip.`
      )
    }
    case 'groundwater': {
      const d = r.data as GroundwaterResult
      return d.inOverexploitedUnit
        ? `Inside overexploited hydrogeological unit ${d.unitName ?? ''} (source IGME).`
        : 'Not inside a declared overexploited hydrogeological unit (source IGME).'
    }
    case 'bathingWater': {
      const d = r.data as BathingWaterResult
      return `Nearest bathing site ${d.siteName} at ${d.distanceKm} km, rating ${d.rating} (source EEA).`
    }
    case 'fireDanger': {
      const d = r.data as FireDangerResult
      // Named as a published forecast class, not a number we derived — the
      // model must not describe it as a measurement.
      return `EFFIS fire danger forecast class for ${d.forDate}: ${d.danger.replace('_', ' ')} (source Copernicus EFFIS).`
    }
    case 'fireHistory': {
      const d = r.data as FireHistoryResult
      if (d.fires.length === 0) {
        return `No burnt area recorded within ${d.radiusKm} km since ${d.since} (source Copernicus EFFIS).`
      }
      const listed = d.fires
        .slice(0, 5)
        .map(f => `${f.date}, ${f.areaHa} ha, ${f.distanceKm} km away${f.commune ? ` near ${f.commune}` : ''}`)
        .join('; ')
      return `${d.fires.length} burnt area(s) recorded within ${d.radiusKm} km since ${d.since}: ${listed} (source Copernicus EFFIS).`
    }
    case 'waterRestrictions': {
      const d = r.data as WaterRestrictionResult
      const perResource = d.zones.map(z => `${z.resource} ${z.level}`).join(', ')
      // Keep VigiEau's own severity word. This is a legal restriction, not an
      // indicator, so softening or upgrading it would misstate the rule.
      return `Drought restriction in force in "${d.zoneName}": ${d.level} (worst of ${perResource})${d.validTo ? `, decree valid to ${d.validTo}` : ''} (source VigiEau).`
    }
    case 'firePrevention': {
      const d = r.data as FirePreventionResult
      return `${d.regionName} has a published wildfire prevention plan (${d.planName}, ${d.source}). Existence of a plan says nothing about risk at this point.`
    }
  }
}

export function buildEvidence(
  results: Partial<Record<DatasetId, DatasetResult>>,
  _language: Language,
): EvidenceItem[] {
  return (Object.entries(results) as Array<[DatasetId, DatasetResult]>)
    .filter(([, r]) => r.status !== 'loading' && r.status !== 'not_applicable')
    .map(([id, r]) => ({ id, status: r.status, summary: summarize(id, r) }))
}

export async function requestInterpretation(
  scope: InterpretationScope,
  question?: string,
): Promise<void> {
  const s = useAppStore.getState()
  if (!s.location) {
    s.setInterpretation({ status: 'error', scope, text: undefined, questions: undefined })
    return
  }

  // Gated on evidence, not on geography. Coverage was never what made an
  // interpretation safe — evidence was, and buildEvidence already hands the
  // model an explicit "no usable value" line per gap rather than hiding them.
  // The old rule refused a place in Extremadura that had a live flood verdict
  // and a live drought reading, because a polygon said "not Andalucía". This
  // refuses only the case that was actually dangerous: nothing to interpret.
  const evidence = buildEvidence(s.results, s.language)
  if (!evidence.some(e => e.status === 'available')) {
    s.setInterpretation({ status: 'error', scope })
    return
  }
  s.setInterpretation({ status: 'loading', scope, language: s.language })
  try {
    const res = await fetch('/api/interpret', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        language: s.language,
        audience: s.audience,
        scope: scope.type === 'dataset' ? scope.id : 'location',
        location: {
          name: s.location.municipality || s.location.displayName,
          municipio: s.location.municipality,
          provincia: s.location.provinceName,
          basin: s.location.basin?.name,
        },
        evidence,
        ...(question ? { question } : {}),
      }),
    })
    if (!res.ok) throw new Error(`Proxy error ${res.status}`)
    const out = (await res.json()) as { interpretation: string; questions: string[] }
    useAppStore.getState().setInterpretation({
      status: 'ready', scope, text: out.interpretation, questions: out.questions,
      basis: evidence.map(e => e.id), language: s.language,
    })
  } catch {
    useAppStore.getState().setInterpretation({ status: 'error', scope })
  }
}
