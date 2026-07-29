import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { DATASETS } from '../../registry/datasets'
import Legend from './Legend'
import type { DatasetId } from '../../types/workspace'

/* A custom control rather than a bare radio/checkbox: the swatch doubles as
   the selected indicator, matching the legend swatches directly below it. The
   real input stays in the DOM, visually hidden, so the control keeps its role,
   its keyboard behaviour and its accessible name. */
function ControlRow({
  type, name, checked, disabled, onChange, swatch, children,
}: {
  type: 'radio' | 'checkbox'
  name?: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
  swatch: ReactNode
  children: ReactNode
}) {
  return (
    <label
      className={`flex min-h-11 items-center gap-2 text-[12.5px] text-ink ${
        disabled ? 'opacity-55' : 'cursor-pointer'
      }`}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className="shrink-0 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus">
        {swatch}
      </span>
      <span>{children}</span>
    </label>
  )
}

export default function LayerTray() {
  const { t } = useTranslation()
  // Local UI state: which layers are drawn is global, but whether this card is
  // folded is nobody's business but this card's. Expanded on desktop, as `3a`
  // shows it; folded to its pill on a phone, where an open card would cover
  // the map it is describing.
  const [open, setOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 768,
  )
  const primaryLayer = useAppStore(s => s.primaryLayer)
  const contextLayers = useAppStore(s => s.contextLayers)
  const setPrimaryLayer = useAppStore(s => s.setPrimaryLayer)
  const toggleContextLayer = useAppStore(s => s.toggleContextLayer)

  const primaries = DATASETS.filter(d => d.mapRole === 'primary')
  const contexts = DATASETS.filter(d => d.mapRole === 'context')

  const dot = (active: boolean, disabled = false) => (
    <span
      className={`block h-3 w-3 rounded-full border-[1.5px] ${
        disabled ? 'border-[#C6BBA3]' : active ? 'border-primary bg-primary' : 'border-field'
      }`}
    />
  )

  return (
    /* Kept clear of MapLibre's zoom buttons, which share this corner (the mock
       omitted them). Collapsed, the card folds to a pill and leaves the map
       open for unobstructed exploration. */
    <div
      className={`absolute right-14 top-[88px] z-10 max-h-[calc(100dvh-7.5rem)] overflow-y-auto bg-canvas transition-[width,border-radius,padding] duration-[var(--dur-panel)] ${
        open
          ? 'w-[236px] rounded-[14px] p-4 shadow-[0_10px_26px_rgba(30,42,56,.16)]'
          : 'rounded-[24px] px-4 py-2.5 shadow-[0_8px_20px_rgba(30,42,56,.16)]'
      }`}
    >
      <div className={`flex items-center gap-2.5 ${open ? 'mb-3 justify-between' : ''}`}>
        <span className="text-[13px] font-bold text-ink">{t('layers.button')}</span>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label={t(open ? 'layers.collapse' : 'layers.expand')}
          className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center"
        >
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-hairline text-[11px] text-muted">
            <span aria-hidden>{open ? '⌄' : '⌃'}</span>
          </span>
        </button>
      </div>

      {open && (
        <>
          <p className="mb-[7px] text-[10.5px] font-bold uppercase tracking-[.04em] text-muted">
            {t('layers.primaryHeading')}
          </p>
          <div role="radiogroup" aria-label={t('layers.primaryHeading')} className="mb-3">
            <ControlRow
              type="radio"
              name="primary"
              checked={primaryLayer === null}
              onChange={() => setPrimaryLayer(null)}
              swatch={dot(primaryLayer === null)}
            >
              {t('layers.none')}
            </ControlRow>
            {primaries.map(d => (
              <ControlRow
                key={d.id}
                type="radio"
                name="primary"
                checked={primaryLayer === d.id}
                disabled={d.mapUnavailable}
                onChange={() => setPrimaryLayer(d.id as DatasetId)}
                swatch={dot(primaryLayer === d.id, d.mapUnavailable)}
              >
                {t(`registry.${d.id}.name`)}
                {d.mapUnavailable && <> ({t('layers.unavailable')})</>}
              </ControlRow>
            ))}
          </div>

          <p className="mb-[7px] text-[10.5px] font-bold uppercase tracking-[.04em] text-muted">
            {t('layers.contextHeading')}
          </p>
          <div className="mb-3.5">
            {contexts.map(d => (
              <ControlRow
                key={d.id}
                type="checkbox"
                checked={contextLayers.includes(d.id)}
                onChange={() => toggleContextLayer(d.id)}
                swatch={
                  <span
                    className={`block h-3 w-3 rounded ${
                      contextLayers.includes(d.id) ? 'bg-primary' : 'border-[1.5px] border-field'
                    }`}
                  />
                }
              >
                {t(`registry.${d.id}.name`)}
              </ControlRow>
            ))}
            {contextLayers.length >= 2 && (
              <p className="mt-1.5 text-[10.5px] text-warning">{t('layers.readabilityWarning')}</p>
            )}
          </div>

          {/* One card, because both answer "what am I looking at?" */}
          <Legend />
        </>
      )}
    </div>
  )
}
