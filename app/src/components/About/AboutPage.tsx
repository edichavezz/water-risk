import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { DATASETS } from '../../registry/datasets'
import { useAppStore } from '../../store/useAppStore'
import { APP_NAME } from '../Header/identity'

const PERSONAL_SITE = 'https://editachavez.com'
const COURSE_URL = 'https://terra.do'

/* The four sections, in reading order. The ids double as the mini-nav's
   anchors and as the scroll-spy's keys. */
const SECTIONS = [
  { id: 'tool', label: 'about.secTool' },
  { id: 'data', label: 'about.secData' },
  { id: 'ai', label: 'about.secAi' },
  { id: 'me', label: 'about.secMe' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

/** One outline chip per data source, deduplicated — several checks can share
    a publisher — linking out wherever the registry knows a URL. */
function SourceChips() {
  const seen = new Map<string, string | undefined>()
  for (const d of [...DATASETS].sort((a, b) => a.defaultOrder - b.defaultOrder)) {
    if (!seen.has(d.source.name)) seen.set(d.source.name, d.source.url)
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {[...seen].map(([name, url]) =>
        url ? (
          <a
            key={name}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-[20px] border border-field px-3 py-1.5 text-xs text-ink hover:border-primary hover:text-primary"
          >
            {name}
          </a>
        ) : (
          <span
            key={name}
            className="rounded-[20px] border border-field px-3 py-1.5 text-xs text-ink"
          >
            {name}
          </span>
        ),
      )}
    </div>
  )
}

/* One plain question per registered dataset, in the registry's own order, so
   the data section can never claim a check the app does not actually run. The
   prose lives in `about.dataItems.<id>`; the source and its link come from the
   registry entry. Hairline-divided, matching the panel's dataset list. */
function DataQuestions() {
  const { t } = useTranslation()
  const ordered = [...DATASETS].sort((a, b) => a.defaultOrder - b.defaultOrder)

  return (
    <ul className="mt-5 border-b border-hairline-soft">
      {ordered.map(d => (
        <li key={d.id} className="border-t border-hairline-soft py-3.5">
          <h3 className="font-display text-[15px] font-semibold leading-snug text-ink">
            {t(`about.dataItems.${d.id}.question`)}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[#33424C]">
            {t(`about.dataItems.${d.id}.answer`)}
          </p>
          <p className="mt-2 text-[11.5px] text-micro">
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

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2.5 font-display text-[17px] font-bold leading-tight text-ink">
      {children}
    </h2>
  )
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-[15px] font-bold leading-snug text-ink">{children}</h3>
}

export default function AboutPage() {
  const { t } = useTranslation()
  const goToSearch = useAppStore(s => s.goToSearch)
  const top = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<SectionId>('tool')

  // Arriving from the header should start at the top of the page and put the
  // reader inside it, the way a real navigation would.
  useEffect(() => { top.current?.focus() }, [])

  // The mini-nav dot follows the reader down the page. Guarded, because the
  // observer does not exist in the jsdom the tests run under — without it the
  // nav simply rests on the first section, which is a fine default.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) setActive(visible[0].target.id as SectionId)
      },
      { rootMargin: '-80px 0px -60% 0px' },
    )
    for (const { id } of SECTIONS) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  const cta = (
    <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        onClick={goToSearch}
        className="min-h-11 rounded-[10px] bg-primary px-6 py-2 text-sm font-bold text-white hover:bg-primary-hover"
      >
        {t('about.introCta')}
      </button>
      <span className="text-[13px] text-muted">{t('about.introCtaHint')}</span>
    </div>
  )

  return (
    <div
      ref={top}
      tabIndex={-1}
      className="absolute inset-0 z-20 overflow-y-auto bg-page outline-none"
    >
      {/* Title block — left-aligned, generous top padding, no photo hero. */}
      <div className="px-6 pt-[112px] sm:px-12">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-micro">
          {t('about.title', { name: APP_NAME })}
        </p>
        <h1 className="font-display text-[32px] font-bold leading-tight text-ink sm:text-[34px]">
          {t('about.introHeading')}
        </h1>
        <p className="mt-2 max-w-[600px] text-sm text-muted">{t('about.subhead')}</p>
      </div>

      {/* Decorative contour band standing in for a hero image. */}
      <div aria-hidden className="topo-divider mx-6 mb-10 mt-5 h-[60px] sm:mx-12" />

      <div className="grid gap-10 px-6 pb-24 sm:px-12 md:grid-cols-[200px_1fr]">
        <nav aria-label={t('about.navHeading')} className="hidden md:block">
          <div className="sticky top-[100px]">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[.06em] text-muted">
              {t('about.navHeading')}
            </p>
            <ul className="text-[13.5px]">
              {SECTIONS.map(s => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    aria-current={active === s.id ? 'true' : undefined}
                    className={`flex items-center gap-2 py-2 ${
                      active === s.id ? 'font-bold text-ink' : 'text-muted hover:text-ink'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        active === s.id ? 'bg-accent' : 'bg-transparent'
                      }`}
                    />
                    {t(s.label)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="max-w-[720px]">
          {/* ── The tool ─────────────────────────────────────────────── */}
          <section id="tool" className="mb-9 scroll-mt-24">
            <SectionHeading>{t('about.secTool')}</SectionHeading>
            <p className="text-sm leading-relaxed text-[#33424C]">{t('about.introLead')}</p>
            <p className="mt-3 text-sm leading-relaxed text-[#33424C]">
              {t('about.introBodyOne')}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[#33424C]">
              {t('about.introBodyTwo')}
            </p>
            {cta}
          </section>

          {/* ── The data ─────────────────────────────────────────────── */}
          <section id="data" className="mb-9 scroll-mt-24">
            <SectionHeading>{t('about.secData')}</SectionHeading>
            <p className="text-sm leading-relaxed text-[#33424C]">{t('about.dataIntro')}</p>
            <SourceChips />

            <div className="mt-6">
              <SubHeading>{t('about.coverageHeading')}</SubHeading>
              <p className="text-sm leading-relaxed text-[#33424C]">{t('about.coverageBody')}</p>
            </div>

            <DataQuestions />
          </section>

          {/* ── The AI ───────────────────────────────────────────────── */}
          <section id="ai" className="mb-9 scroll-mt-24">
            <SectionHeading>{t('about.secAi')}</SectionHeading>
            <SubHeading>{t('about.aiHeading')}</SubHeading>
            <p className="text-sm leading-relaxed text-[#33424C]">{t('about.aiBodyOne')}</p>
            <p className="mt-3 text-sm leading-relaxed text-[#33424C]">{t('about.aiBodyTwo')}</p>

            <div className="mt-5 rounded-2xl border border-hairline bg-accent-soft/60 p-5">
              <SubHeading>{t('about.aiAudienceHeading')}</SubHeading>
              <p className="text-sm leading-relaxed text-[#4A3A2C]">{t('about.aiAudienceBody')}</p>
              <p className="mt-3 text-[13px] leading-relaxed text-[#4A3A2C]">
                {t('about.aiAudienceNote')}
              </p>
            </div>
          </section>

          {/* ── Me ───────────────────────────────────────────────────── */}
          <section id="me" className="mb-9 scroll-mt-24">
            <SectionHeading>{t('about.secMe')}</SectionHeading>
            <div className="flex items-start gap-3">
              {/* Placeholder until a photo is supplied. */}
              <span
                aria-hidden
                className="mt-0.5 h-10 w-10 shrink-0 rounded-lg"
                style={{
                  background: 'repeating-linear-gradient(45deg,#C1663D 0 6px,#D98A5F 6px 12px)',
                }}
              />
              <div>
                <SubHeading>{t('about.makerHeading')}</SubHeading>
                <p className="text-sm leading-relaxed text-[#33424C]">{t('about.makerBodyOne')}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#33424C]">{t('about.makerBodyTwo')}</p>
            <p className="mt-3 text-sm leading-relaxed text-[#33424C]">
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
            {cta}
          </section>

          {/* Understated, not boxed — a line to notice, not a warning panel. */}
          <div className="mt-12 border-t border-hairline pt-4 text-[11.5px] leading-relaxed text-muted">
            <h3 className="font-bold text-muted">{t('about.disclaimerHeading')}</h3>
            <p className="mt-1">{t('about.disclaimerBody')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
