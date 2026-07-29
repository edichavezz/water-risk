import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { requestInterpretation } from '../../services/ai'

function AssistedLabel({ text }: { text: string }) {
  // The AI-assisted disclosure lives on the generated content itself, not on
  // the tab (spec §7.5 / §10.2). Terracotta wash, matching the accent the
  // active tab underline uses on this side of the panel.
  return (
    <span className="self-start rounded-[20px] bg-accent-soft px-2.5 py-[3px] text-[10px] font-bold text-accent-ink">
      {text}
    </span>
  )
}

export default function InterpretationView() {
  const { t } = useTranslation()
  const interpretation = useAppStore(s => s.interpretation)
  const coverage = useAppStore(s => s.coverage)
  const [followUp, setFollowUp] = useState('')

  const scope = interpretation.scope ?? { type: 'location' as const }
  // Scoped to the dataset it was opened from, so arriving via "Explain this
  // result" and via the tab both name what is actually being explained.
  const title =
    scope.type === 'dataset'
      ? t('ai.titleDataset', { dataset: t(`registry.${scope.id}.name`) })
      : t('ai.titleLocation')
  const regenerate = () => void requestInterpretation(scope)

  if (coverage && !coverage.supported) {
    return <p className="text-[13px] leading-relaxed text-ink">{t('ai.unsupported')}</p>
  }

  if (interpretation.status === 'idle') return null

  if (interpretation.status === 'loading') {
    return <p className="text-[13px] text-muted">{t('ai.loading')}</p>
  }

  if (interpretation.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-[13px] text-ink">{t('ai.error')}</p>
        <button
          onClick={regenerate}
          className="min-h-11 rounded-[10px] border border-field px-3 py-2 text-[13px] font-bold text-ink hover:bg-subtle-cool"
        >
          {t('ai.regenerate')}
        </button>
      </div>
    )
  }

  const ask = (question: string) => {
    if (!question.trim()) return
    setFollowUp('')
    void requestInterpretation(scope, question)
  }

  return (
    <div className="flex flex-col gap-3">
      <AssistedLabel text={t('ai.assistedLabel')} />
      <h2 className="font-display text-[17px] font-semibold leading-snug text-ink">{title}</h2>

      <p
        className={`-mt-1 text-[13px] leading-relaxed text-[#33424C] ${
          interpretation.status === 'stale' ? 'opacity-50' : ''
        }`}
      >
        {interpretation.text}
      </p>

      {interpretation.basis && interpretation.basis.length > 0 && (
        <p className="-mt-1.5 text-[11px] text-micro">
          {t('ai.basis', {
            sources: interpretation.basis.map(id => t(`registry.${id}.name`)).join(', '),
          })}
        </p>
      )}

      {interpretation.status === 'stale' && (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-hairline bg-accent-soft/60 p-3">
          <p className="text-[13px] text-ink">
            {t(interpretation.staleReason === 'audience' ? 'ai.staleAudience' : 'ai.stale')}
          </p>
          <button
            onClick={regenerate}
            className="min-h-11 rounded-[10px] bg-primary px-3 py-2 text-[13px] font-bold text-white hover:bg-primary-hover"
          >
            {t('ai.regenerate')}
          </button>
        </div>
      )}

      {interpretation.status === 'ready' && (
        <>
          {interpretation.questions && interpretation.questions.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[.03em] text-micro">
                {t('ai.suggested')}
              </p>
              <div className="flex flex-col gap-1.5">
                {interpretation.questions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => ask(q)}
                    className="min-h-11 rounded-[20px] border border-field px-3.5 py-2 text-left text-xs text-ink hover:bg-subtle-cool"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up appears only after an interpretation exists, and stays
              scoped to the evidence already shown (spec §10.2). */}
          <div>
            <label htmlFor="ai-followup" className="mb-1.5 block text-[11px] font-bold text-micro">
              {t('ai.followUpLabel')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="ai-followup"
                type="text"
                value={followUp}
                onChange={e => setFollowUp(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') ask(followUp) }}
                className="min-h-11 flex-1 rounded-[20px] border border-field bg-canvas px-4 py-2 text-[13px] outline-none focus:border-primary"
              />
              {/* The arrow is decorative; the button keeps its worded label
                  for anyone not reading the glyph. */}
              <button
                onClick={() => ask(followUp)}
                aria-label={t('ai.followUpSend')}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white hover:bg-primary-hover"
              >
                <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
