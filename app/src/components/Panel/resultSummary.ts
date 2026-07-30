import type { DatasetId, DatasetResult } from '../../types/workspace'
import type {
  FloodZoneResult, DroughtStatus, Reservoir, WaterQualityResult,
  CoastalZoning, GroundwaterResult, BathingWaterResult,
  FireDangerResult, FireHistoryResult, FirePreventionResult, WaterRestrictionResult,
} from '../../types'

type TFunc = (key: string, opts?: Record<string, unknown>) => string

/**
 * The concise row/detail statement for a dataset. Non-available statuses always
 * render their explicit state copy — never a value, never a "safe" reading
 * (spec §9.2).
 */
export function resultSummary(id: DatasetId, r: DatasetResult | undefined, t: TFunc): string {
  const status = r?.status ?? 'loading'
  // An empty reservoir result isn't a source failure — it means we hold no
  // supply-system record for this municipality, which is a different fact and
  // the common one. "No current result available" would misattribute it.
  if (id === 'reservoirs' && status === 'unavailable') {
    return t('panel.summary.reservoirs.noSupplyRecord')
  }
  // Likewise for coastal: "unavailable" here means no coastal protection zoning
  // reaches this point, not that the source failed.
  if (id === 'coastalFlood' && status === 'unavailable') {
    return t('panel.summary.coastalFlood.noZoning')
  }
  if (status !== 'available') return t(`states.${status}`)

  switch (id) {
    case 'flood': {
      const d = r!.data as FloodZoneResult
      return d.inZone
        ? t('panel.summary.flood.inZone', { period: d.returnPeriod })
        : t('panel.summary.flood.outZone')
    }
    case 'drought': {
      const d = r!.data as DroughtStatus
      return t(`risk.drought.${d.level}`)
    }
    case 'reservoirs': {
      const rs = r!.data as Reservoir[]
      if (rs.length === 0) return t('panel.summary.reservoirs.noSupplyRecord')
      const closest = rs[0]
      return t('panel.summary.reservoirs.headline', {
        name: closest.name, percent: closest.fillPercent,
      })
    }
    case 'waterQuality': {
      const d = r!.data as WaterQualityResult
      return t('panel.summary.waterQuality.value', {
        compliance: t(`risk.waterQuality.${d.compliance}`), year: d.year,
      })
    }
    case 'coastalFlood': {
      const d = r!.data as CoastalZoning
      // Leads with the classification because that is the decision-relevant
      // fact; never phrased as an in/out verdict, which this source cannot give.
      if (d.zoning) return t('panel.summary.coastalFlood.zoning', { zoning: d.zoning })
      if (d.location) return t('panel.summary.coastalFlood.nearZone', { location: d.location })
      return t('panel.summary.coastalFlood.inZoning')
    }
    case 'groundwater': {
      const d = r!.data as GroundwaterResult
      return d.inOverexploitedUnit
        ? t('panel.summary.groundwater.over', { unit: d.unitName ?? '' })
        : t('panel.summary.groundwater.clear')
    }
    case 'bathingWater': {
      const d = r!.data as BathingWaterResult
      return t('panel.summary.bathingWater.site', {
        name: d.siteName, rating: d.rating, km: d.distanceKm,
      })
    }
    case 'fireDanger': {
      const d = r!.data as FireDangerResult
      return t(`risk.fireDanger.${d.danger}`)
    }
    case 'fireHistory': {
      const d = r!.data as FireHistoryResult
      // An empty archive is an answer, not a gap — but it must be scoped, or
      // "no fires" reads as a guarantee rather than as a record of what was
      // mapped within a radius since a given year.
      if (d.fires.length === 0) {
        return t('panel.summary.fireHistory.none', { km: d.radiusKm, since: d.since })
      }
      const worst = [...d.fires].sort((a, b) => b.areaHa - a.areaHa)[0]
      return t('panel.summary.fireHistory.count', {
        count: d.fires.length,
        km: d.radiusKm,
        largest: worst.areaHa,
        year: d.fires[0].date.slice(0, 4),
      })
    }
    case 'waterRestrictions': {
      const d = r!.data as WaterRestrictionResult
      return t('panel.summary.waterRestrictions.level', {
        level: t(`risk.waterRestrictions.${d.level}`),
        zone: d.zoneName,
      })
    }
    case 'firePrevention': {
      const d = r!.data as FirePreventionResult
      return t('panel.summary.firePrevention.plan', {
        plan: d.planName, region: d.regionName,
      })
    }
  }
}
