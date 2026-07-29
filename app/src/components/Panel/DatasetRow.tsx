import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { resultSummary } from './resultSummary'
import { retryDataset } from '../Entry/submitLocation'
import type { DatasetDef } from '../../registry/datasets'

// Non-colour status cue (spec §14): every status also carries a glyph and an
// accessible label, so colour is never the sole carrier of meaning.
const STATUS_GLYPH: Record<string, string> = {
  available: '●',
  loading: '◌',
  error: '⚠',
  unavailable: '○',
  unsupported: '○',
  not_applicable: '○',
}

export default function DatasetRow({ def }: { def: DatasetDef }) {
  const { t } = useTranslation()
  const result = useAppStore(s => s.results[def.id])
  const selectDataset = useAppStore(s => s.selectDataset)
  const status = result?.status ?? 'loading'

  return (
    <div className="rounded-xl bg-subtle-warm hover:bg-subtle-cool">
      <button
        onClick={() => selectDataset(def.id)}
        className="flex min-h-11 w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left"
      >
        <span className="flex flex-wrap items-center gap-2">
          {/* Hazard colour is added to the glyph, never substituted for it: the
              glyph stays the non-colour status cue. Only `available` takes the
              family colour — a terracotta hollow ring would read as a fire
              finding rather than a missing fire reading. */}
          <span
            aria-hidden
            className={`text-xs ${
              status === 'available'
                ? def.hazard === 'fire'
                  ? 'text-accent'
                  : 'text-primary'
                : 'text-muted'
            }`}
          >
            {STATUS_GLYPH[status]}
          </span>
          <span className="font-title text-sm font-bold text-ink">
            {t(`registry.${def.id}.name`)}
          </span>
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
              def.hazard === 'fire'
                ? 'bg-accent-soft text-[#8A5A34]'
                : 'bg-primary-soft text-[#1F4F63]'
            }`}
          >
            {t(`hazard.${def.hazard}`)}
          </span>
          {def.mapRole !== 'none' && (
            <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted">
              {t('panel.mapLayer')}
            </span>
          )}
        </span>
        {/* The summary states the status in words for every non-available
            case, so the glyph above is decorative and needs no sr-only twin. */}
        <span className="text-sm text-ink">{resultSummary(def.id, result, t)}</span>
        <span className="text-xs text-muted">{t(`registry.${def.id}.cadence`)}</span>
      </button>
      {status === 'error' && (
        <div className="px-3 pb-2">
          <button
            onClick={() => void retryDataset(def.id)}
            className="min-h-11 rounded-lg border border-border px-2 py-1 text-xs font-bold text-ink hover:bg-canvas"
          >
            {t('states.retry')}
          </button>
        </div>
      )}
    </div>
  )
}
