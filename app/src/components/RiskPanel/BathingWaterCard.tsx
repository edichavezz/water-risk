import { useTranslation } from 'react-i18next'
import type { BathingWaterResult } from '../../types'

interface Props { data: BathingWaterResult | null; loading: boolean }

const RATING_CONFIG: Record<BathingWaterResult['rating'], { emoji: string; bg: string; border: string; text: string }> = {
  excellent:  { emoji: '✅', bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800' },
  good:       { emoji: '🟢', bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800' },
  sufficient: { emoji: '🟡', bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800' },
  poor:       { emoji: '❌', bg: 'bg-red-50',   border: 'border-red-300',   text: 'text-red-800' },
  unknown:    { emoji: '⚪', bg: 'bg-gray-50',  border: 'border-gray-200',  text: 'text-gray-600' },
}

export default function BathingWaterCard({ data, loading }: Props) {
  const { t } = useTranslation()

  if (loading) return <CardShell><Skeleton /></CardShell>
  if (!data) return null

  const cfg = RATING_CONFIG[data.rating]

  return (
    <CardShell>
      <div className={`rounded-lg px-3 py-2.5 border ${cfg.bg} ${cfg.border}`}>
        <div className={`flex items-center gap-2 text-sm font-semibold ${cfg.text}`}>
          <span>{cfg.emoji}</span>
          {t(`risk.bathingWater.${data.rating}`)}
        </div>
        <p className="text-xs text-gray-600 mt-1">{data.siteName}</p>
        <p className="text-xs text-gray-500">{t('risk.bathingWater.distance', { distance: data.distanceKm })}</p>
      </div>
      <p className="text-xs text-gray-400">{t('risk.bathingWater.source', { year: data.year })}</p>
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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">🏊 {t('risk.bathingWater.title')}</h3>
      {children}
    </div>
  )
}
