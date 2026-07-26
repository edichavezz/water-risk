import type { DatasetId, DatasetResult } from '../../types/workspace'
import type {
  FloodZoneResult, DroughtStatus, Reservoir, WaterQualityResult,
  CoastalFloodResult, GroundwaterResult, BathingWaterResult,
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
      const d = r!.data as CoastalFloodResult
      if (d.inServidumbre) return t('panel.summary.coastalFlood.servidumbre')
      if (d.inPolicia) return t('panel.summary.coastalFlood.policia')
      return t('panel.summary.coastalFlood.clear')
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
  }
}
