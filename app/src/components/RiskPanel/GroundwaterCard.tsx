import { useTranslation } from 'react-i18next'
import type { GroundwaterResult } from '../../types'

interface Props { data: GroundwaterResult | null; loading: boolean }

export default function GroundwaterCard({ data, loading }: Props) {
  const { t } = useTranslation()

  if (loading) return <CardShell><Skeleton /></CardShell>
  if (!data) {
    return <CardShell><p className="text-sm text-gray-500">{t('risk.groundwater.noData')}</p></CardShell>
  }

  if (data.inOverexploitedUnit) {
    return (
      <CardShell>
        <div className="rounded-lg px-3 py-2.5 border bg-amber-50 border-amber-300">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <span>⚠️</span>
            {t('risk.groundwater.overexploited', { unit: data.unitName })}
          </div>
        </div>
        <p className="text-xs text-gray-400">{t('risk.groundwater.source')}</p>
      </CardShell>
    )
  }

  return (
    <CardShell>
      <div className="flex items-center gap-2 text-sm text-green-700">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
        {t('risk.groundwater.clear')}
      </div>
      <p className="text-xs text-gray-400">{t('risk.groundwater.source')}</p>
    </CardShell>
  )
}

function Skeleton() {
  return <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
}

function CardShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">🪨 {t('risk.groundwater.title')}</h3>
      {children}
    </div>
  )
}
