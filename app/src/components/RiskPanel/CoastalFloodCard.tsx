import { useTranslation } from 'react-i18next'
import type { CoastalFloodResult } from '../../types'

interface Props { data: CoastalFloodResult | null; loading: boolean; isCoastal: boolean }

export default function CoastalFloodCard({ data, loading, isCoastal }: Props) {
  const { t } = useTranslation()

  if (!isCoastal) return null
  if (loading) return <CardShell><Skeleton /></CardShell>
  if (!data) return null

  const status = data.inServidumbre
    ? { emoji: '🔴', bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', key: 'inServidumbre' as const }
    : data.inPolicia
    ? { emoji: '🟠', bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', key: 'inPolicia' as const }
    : { emoji: '✅', bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800', key: 'clear' as const }

  return (
    <CardShell>
      <div className={`rounded-lg px-3 py-2.5 border ${status.bg} ${status.border}`}>
        <div className={`flex items-center gap-2 text-sm font-semibold ${status.text}`}>
          <span>{status.emoji}</span>
          {t(`risk.coastalFlood.${status.key}`)}
        </div>
      </div>
      <p className="text-xs text-gray-400">{t('risk.coastalFlood.source')}</p>
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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">🏖️ {t('risk.coastalFlood.title')}</h3>
      {children}
    </div>
  )
}
