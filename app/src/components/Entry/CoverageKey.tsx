import { useTranslation } from 'react-i18next'

export default function CoverageKey() {
  const { t } = useTranslation()
  return (
    <div className="absolute bottom-8 right-6 z-10 max-w-[220px] rounded-[14px] bg-canvas/95 p-3.5 text-[11px] shadow-[0_4px_16px_rgba(30,42,56,.14)]">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#7FA38C', opacity: 0.7 }} />
        <span className="text-ink">{t('entry.keyAvailable')}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-hairline" />
        <span className="text-ink">{t('entry.keyUnavailable')}</span>
      </div>
      <p className="mt-2.5 leading-relaxed text-muted">{t('entry.coverageNote')}</p>
    </div>
  )
}
