import { useTranslation } from 'react-i18next'
import type { Reservoir } from '../../types'

interface Props { reservoirs: Reservoir[]; loading: boolean }

function FillBar({ percent, mean }: { percent: number; mean?: number }) {
  const colour =
    percent < 25 ? 'bg-red-500' :
    percent < 40 ? 'bg-orange-400' :
    percent < 60 ? 'bg-yellow-400' : 'bg-blue-500'

  return (
    <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${colour}`} style={{ width: `${percent}%` }} />
      {mean !== undefined && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-400 opacity-60"
          style={{ left: `${mean}%` }}
          title={`Historical mean: ${mean}%`}
        />
      )}
    </div>
  )
}

export default function ReservoirCard({ reservoirs, loading }: Props) {
  const { t } = useTranslation()

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        💧 {t('risk.reservoirs.title')}
      </h3>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : reservoirs.length === 0 ? (
        <p className="text-sm text-gray-500">{t('risk.reservoirs.noData')}</p>
      ) : (
        <div className="space-y-3">
          {reservoirs.map((r, i) => (
            <div key={i}>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-xs font-medium text-gray-700 truncate pr-2">{r.name}</span>
                <span className={`text-xs font-bold shrink-0 ${
                  r.fillPercent < 25 ? 'text-red-600' :
                  r.fillPercent < 40 ? 'text-orange-500' : 'text-blue-600'
                }`}>
                  {r.fillPercent}%
                </span>
              </div>
              <FillBar percent={r.fillPercent} mean={r.historicalMeanPercent} />
              <div className="flex justify-between mt-0.5">
                <span className="text-xs text-gray-400">{r.distanceKm} km away</span>
                {r.historicalMeanPercent && (
                  <span className="text-xs text-gray-400">
                    {t('risk.reservoirs.historical', { mean: r.historicalMeanPercent })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">Source: REDIAM / MITERD (static seed — live API in v2)</p>
    </div>
  )
}
