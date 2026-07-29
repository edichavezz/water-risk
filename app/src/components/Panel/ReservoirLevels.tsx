import { useTranslation } from 'react-i18next'
import { fillColour } from '../../services/reservoirs'
import type { Reservoir } from '../../types'

// A fill % is uninterpretable on its own: 34% reads as merely lowish until you
// learn that late July normally sits at 61%. Each reservoir is therefore shown
// against its own average for the same calendar date, as a signed gap.
function Comparison({ years, mean, fillPercent }: {
  years: 5 | 10
  mean: number
  fillPercent: number
}) {
  const { t } = useTranslation()
  const gap = Math.round(fillPercent - mean)
  const below = gap < 0
  const direction = t(below ? 'map.reservoir.below' : 'map.reservoir.above')

  return (
    /* The arrow is decorative — the accessible label carries the same fact in
       words, so neither colour nor glyph is the sole carrier of meaning. */
    <span
      className="whitespace-nowrap"
      aria-label={t('panel.summary.reservoirs.comparisonLabel', {
        gap: Math.abs(gap), direction, years,
      })}
    >
      {t('panel.summary.reservoirs.avg', { years, mean })}{' '}
      <span className={below ? 'text-accent' : 'text-primary'}>
        <span aria-hidden>{below ? '▼' : '▲'}</span>
        {Math.abs(gap)}
      </span>
    </span>
  )
}

export default function ReservoirLevels({ reservoirs }: { reservoirs: Reservoir[] }) {
  const { t } = useTranslation()
  if (reservoirs.length === 0) return null

  return (
    <ul className="flex flex-col gap-3">
      {reservoirs.map(r => (
        <li key={r.codEst} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12.5px] font-bold text-ink">{r.name}</span>
            <span className="text-[12.5px] font-bold text-ink">{r.fillPercent}%</span>
          </div>

          {/* The bar is a second, non-numeric read of the same value. */}
          <div
            className="h-1.5 overflow-hidden rounded-full bg-subtle-cool"
            role="img"
            aria-label={t('risk.reservoirs.fill', { percent: r.fillPercent })}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(Math.max(r.fillPercent, 0), 100)}%`,
                backgroundColor: fillColour(r.fillPercent),
              }}
            />
          </div>

          {/* Averages are omitted, never zero-filled, where a station has too
              few reporting years for one to mean anything. */}
          {(r.mean5yr != null || r.mean10yr != null) && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
              {r.mean5yr != null && (
                <Comparison years={5} mean={r.mean5yr} fillPercent={r.fillPercent} />
              )}
              {r.mean10yr != null && (
                <Comparison years={10} mean={r.mean10yr} fillPercent={r.fillPercent} />
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
