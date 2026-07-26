import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { requestInterpretation } from '../../services/ai'

function AssistedLabel({ text }: { text: string }) {
  // The AI-assisted disclosure lives on the generated content itself, not on
  // the tab (spec §7.5 / §10.2).
  return (
    <span className="inline-block rounded-lg bg-primary-soft px-2 py-1 text-xs font-bold text-primary">
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
  const title = scope.type === 'dataset' ? t('ai.titleDataset') : t('ai.titleLocation')
  const regenerate = () => void requestInterpretation(scope)

  if (coverage && !coverage.supported) {
    return <p className="text-sm text-ink">{t('ai.unsupported')}</p>
  }

  if (interpretation.status === 'idle') return null

  if (interpretation.status === 'loading') {
    return <p className="text-sm text-muted">{t('ai.loading')}</p>
  }

  if (interpretation.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-ink">{t('ai.error')}</p>
        <button
          onClick={regenerate}
          className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-ink hover:bg-subtle-cool"
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
      <h2 className="text-lg font-bold text-ink">{title}</h2>

      {interpretation.basis && interpretation.basis.length > 0 && (
        <p className="text-xs text-muted">
          {t('ai.basis', {
            sources: interpretation.basis.map(id => t(`registry.${id}.name`)).join(', '),
          })}
        </p>
      )}

      <p className={`text-sm text-ink ${interpretation.status === 'stale' ? 'opacity-50' : ''}`}>
        {interpretation.text}
      </p>

      {interpretation.status === 'stale' && (
        <div className="flex flex-col items-start gap-2 rounded-xl bg-subtle-warm p-3">
          <p className="text-sm text-ink">
            {t(interpretation.staleReason === 'audience' ? 'ai.staleAudience' : 'ai.stale')}
          </p>
          <button
            onClick={regenerate}
            className="min-h-11 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary-hover"
          >
            {t('ai.regenerate')}
          </button>
        </div>
      )}

      {interpretation.status === 'ready' && (
        <>
          {interpretation.questions && interpretation.questions.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-bold text-muted">{t('ai.suggested')}</p>
              <div className="flex flex-col gap-1">
                {interpretation.questions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => ask(q)}
                    className="min-h-11 rounded-lg bg-subtle-warm px-3 py-2 text-left text-sm text-ink hover:bg-subtle-cool"
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
            <label htmlFor="ai-followup" className="mb-1 block text-xs font-bold text-muted">
              {t('ai.followUpLabel')}
            </label>
            <div className="flex gap-2">
              <input
                id="ai-followup"
                type="text"
                value={followUp}
                onChange={e => setFollowUp(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') ask(followUp) }}
                className="min-h-11 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={() => ask(followUp)}
                className="min-h-11 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary-hover"
              >
                {t('ai.followUpSend')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
