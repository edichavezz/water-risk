import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { DATASETS } from '../../registry/datasets'
import { useAppStore } from '../../store/useAppStore'
import { APP_NAME } from '../Header/identity'

const PERSONAL_SITE = 'https://editachavez.com'
const COURSE_URL = 'https://terra.do'

/* One card per registered dataset, in the registry's own order, so the data
   section can never claim a check the app does not actually run. The prose
   lives in `about.dataItems.<id>`; the source and its link come from the
   registry entry. */
function DataQuestions() {
  const { t } = useTranslation()
  const ordered = [...DATASETS].sort((a, b) => a.defaultOrder - b.defaultOrder)

  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2">
      {ordered.map(d => (
        <li
          key={d.id}
          className="rounded-2xl border border-hairline bg-canvas p-5 shadow-sm"
        >
          <h3 className="font-title text-base font-bold leading-snug text-ink">
            {t(`about.dataItems.${d.id}.question`)}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {t(`about.dataItems.${d.id}.answer`)}
          </p>
          <p className="mt-3 border-t border-hairline pt-3 text-xs text-muted">
            <span className="font-bold uppercase tracking-wide">
              {t('about.dataSourceLabel')}
            </span>{' '}
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
              d.source.name
            )}
          </p>
        </li>
      ))}
    </ul>
  )
}

export default function AboutPage() {
  const { t } = useTranslation()
  const goToSearch = useAppStore(s => s.goToSearch)
  const top = useRef<HTMLDivElement>(null)

  // Arriving from the banner should start at the top of the page and put the
  // reader inside it, the way a real navigation would.
  useEffect(() => { top.current?.focus() }, [])

  return (
    <div
      ref={top}
      tabIndex={-1}
      className="absolute inset-0 z-20 overflow-y-auto bg-canvas outline-none"
    >
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-24 sm:px-8">
        {/* ── What this project is, and why ───────────────────────────── */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            {t('about.title', { name: APP_NAME })}
          </p>
          <h2 className="mt-2 font-title text-3xl font-bold leading-tight text-ink sm:text-4xl">
            {t('about.introHeading')}
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink">{t('about.introLead')}</p>
          <p className="mt-4 leading-relaxed text-muted">{t('about.introBodyOne')}</p>
          <p className="mt-4 leading-relaxed text-muted">{t('about.introBodyTwo')}</p>

          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={goToSearch}
              className="min-h-11 rounded-lg bg-primary px-6 py-2 font-bold text-white hover:bg-primary-hover"
            >
              {t('about.introCta')}
            </button>
            <span className="text-sm text-muted">{t('about.introCtaHint')}</span>
          </div>
        </section>

        {/* ── The AI, and what the owner/buyer answer is used for ──────── */}
        <section className="mt-14 border-t border-hairline pt-10">
          <h2 className="font-title text-2xl font-bold text-ink">{t('about.aiHeading')}</h2>
          <p className="mt-4 leading-relaxed text-muted">{t('about.aiBodyOne')}</p>
          <p className="mt-4 leading-relaxed text-muted">{t('about.aiBodyTwo')}</p>

          <div className="mt-6 rounded-2xl bg-subtle-cool p-5">
            <h3 className="font-title text-base font-bold text-ink">{t('about.aiAudienceHeading')}</h3>
            <p className="mt-2 leading-relaxed text-muted">{t('about.aiAudienceBody')}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {t('about.aiAudienceNote')}
            </p>
          </div>
        </section>

        {/* ── The data: one plain question per dataset ─────────────────── */}
        <section className="mt-14 border-t border-hairline pt-10">
          <h2 className="font-title text-2xl font-bold text-ink">{t('about.dataHeading')}</h2>
          <p className="mt-4 leading-relaxed text-muted">{t('about.dataIntro')}</p>
          <DataQuestions />

          <div className="mt-6 rounded-2xl bg-subtle-warm p-5">
            <h3 className="font-title text-base font-bold text-ink">{t('about.coverageHeading')}</h3>
            <p className="mt-2 leading-relaxed text-muted">{t('about.coverageBody')}</p>
            <h3 className="mt-4 font-title text-base font-bold text-ink">
              {t('about.disclaimerHeading')}
            </h3>
            <p className="mt-2 leading-relaxed text-muted">{t('about.disclaimerBody')}</p>
          </div>
        </section>

        {/* ── The person behind it ─────────────────────────────────────── */}
        <section className="mt-14 border-t border-hairline pt-10">
          <h2 className="font-title text-2xl font-bold text-ink">{t('about.makerHeading')}</h2>
          <p className="mt-4 leading-relaxed text-muted">{t('about.makerBodyOne')}</p>
          <p className="mt-4 leading-relaxed text-muted">{t('about.makerBodyTwo')}</p>
          <p className="mt-5 leading-relaxed text-muted">
            <a
              href={PERSONAL_SITE}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-primary underline"
            >
              {t('about.makerSiteLabel')}
            </a>{' '}
            {t('about.makerSiteSuffix')}{' '}
            <a
              href={COURSE_URL}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              {t('about.makerCourseLabel')}
            </a>
          </p>

          <button
            type="button"
            onClick={goToSearch}
            className="mt-8 min-h-11 rounded-lg bg-primary px-6 py-2 font-bold text-white hover:bg-primary-hover"
          >
            {t('about.introCta')}
          </button>
        </section>
      </div>
    </div>
  )
}
