import { useTranslation } from 'react-i18next'

export default function CoverageKey() {
  const { t } = useTranslation()
  return (
    <div className="absolute bottom-8 right-4 z-10 max-w-[240px] rounded-xl bg-canvas/95 p-3 text-xs shadow-md">
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#7FA38C', opacity: 0.7 }} />
        <span className="text-ink">{t('entry.keyAvailable')}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#DDE4E0' }} />
        <span className="text-ink">{t('entry.keyUnavailable')}</span>
      </div>
      <p className="mt-2 text-muted">{t('entry.coverageNote')}</p>
    </div>
  )
}
