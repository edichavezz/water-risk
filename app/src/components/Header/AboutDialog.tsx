import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { DATASETS } from '../../registry/datasets'
import { APP_NAME } from './identity'

/* Prose sections, in reading order. Each maps to `about.<key>Heading` and
   `about.<key>Body`. The sources list is derived from the registry instead,
   so it can't drift from the datasets actually shipped. */
const SECTIONS = ['what', 'coverage', 'ai', 'disclaimer'] as const

export default function AboutDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-canvas p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-bold text-ink">
            {t('about.title', { name: APP_NAME })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-ink hover:bg-subtle-cool"
          >
            {t('about.close')}
          </button>
        </div>

        {SECTIONS.map(key => (
          <section key={key} className="mt-4">
            <h3 className="text-sm font-bold text-ink">{t(`about.${key}Heading`)}</h3>
            <p className="mt-1 text-sm text-muted">{t(`about.${key}Body`)}</p>
          </section>
        ))}

        <section className="mt-4">
          <h3 className="text-sm font-bold text-ink">{t('about.sourcesHeading')}</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {DATASETS.map(d => (
              <li key={d.id}>
                <span className="text-ink">{t(`registry.${d.id}.name`)}</span>
                <span className="text-muted"> — </span>
                {d.source.url ? (
                  <a
                    href={d.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    {d.source.name}
                  </a>
                ) : (
                  <span className="text-muted">{d.source.name}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
