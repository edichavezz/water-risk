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

// A reading present, a reading that went wrong, and no reading at all — the
// three cases the dot distinguishes. Rows without a reading also drop to 60%
// so the list's live signal stands out at a glance.
//
// Only `available` takes its hazard family's colour (see below). The other
// states keep a neutral tone deliberately: a terracotta hollow ring would read
// as a fire *finding* rather than as a missing fire *reading*.
const STATUS_TONE: Record<string, string> = {
  loading: 'text-muted',
  error: 'text-accent',
  unavailable: 'text-[#8A9AA1]',
  unsupported: 'text-[#8A9AA1]',
  not_applicable: 'text-[#8A9AA1]',
}

const FADED = new Set(['unavailable', 'unsupported', 'not_applicable'])

export default function DatasetRow({ def }: { def: DatasetDef }) {
  const { t } = useTranslation()
  const result = useAppStore(s => s.results[def.id])
  const selectDataset = useAppStore(s => s.selectDataset)
  const status = result?.status ?? 'loading'

  return (
    /* Rows are separated by a hairline, not each given a filled block, so the
       list reads as one continuous table. Only the top rule is drawn here;
       DatasetList closes off the last row. */
    <div className={`border-t border-hairline-soft ${FADED.has(status) ? 'opacity-60' : ''}`}>
      <button
        onClick={() => selectDataset(def.id)}
        className="flex min-h-11 w-full flex-col items-start gap-0.5 py-[11px] text-left hover:bg-subtle-cool/50"
      >
        <span className="flex flex-wrap items-center gap-x-[7px] gap-y-1">
          {/* Hazard colour is added to the glyph, never substituted for it —
              the glyph stays the non-colour status cue (spec §14). */}
          <span
            aria-hidden
            className={`text-[9px] leading-none ${
              status === 'available'
                ? def.hazard === 'fire'
                  ? 'text-accent'
                  : 'text-primary'
                : STATUS_TONE[status]
            }`}
          >
            {STATUS_GLYPH[status]}
          </span>
          <span className="font-display text-[12.5px] font-bold text-ink">
            {t(`registry.${def.id}.name`)}
          </span>
          <span
            className={`rounded-md px-1.5 py-px text-[9px] font-bold ${
              def.hazard === 'fire'
                ? 'bg-accent-soft text-accent-ink'
                : 'bg-primary-soft text-primary-hover'
            }`}
          >
            {t(`hazard.${def.hazard}`)}
          </span>
          {def.mapRole !== 'none' && (
            <span className="rounded-md border border-field px-1.5 py-px text-[9px] text-muted">
              {t('panel.mapLayer')}
            </span>
          )}
        </span>
        {/* The summary states the status in words for every non-available
            case, so the glyph above is decorative and needs no sr-only twin.
            Indented to hang under the name, clear of the status dot. */}
        <span className="ml-4 text-[11.5px] leading-snug text-ink">
          {resultSummary(def.id, result, t)}
        </span>
        <span className="ml-4 text-[10px] text-muted">{t(`registry.${def.id}.cadence`)}</span>
      </button>
      {status === 'error' && (
        <div className="ml-4 pb-2">
          <button
            onClick={() => void retryDataset(def.id)}
            className="min-h-11 rounded-lg border border-field px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-subtle-cool"
          >
            {t('states.retry')}
          </button>
        </div>
      )}
    </div>
  )
}
