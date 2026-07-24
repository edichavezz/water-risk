import { useTranslation } from 'react-i18next'
import type { DroughtStatus } from '../../types'

interface Props { data: DroughtStatus | null; loading: boolean }

const LEVEL_CONFIG: Record<DroughtStatus['level'], { bg: string; border: string; dot: string; text: string; emoji: string }> = {
  alert:            { bg: 'bg-red-50',    border: 'border-red-300',    dot: 'bg-red-500',    text: 'text-red-800',    emoji: '🔴' },
  warning:          { bg: 'bg-orange-50', border: 'border-orange-300', dot: 'bg-orange-500', text: 'text-orange-800', emoji: '🟠' },
  watch:            { bg: 'bg-yellow-50', border: 'border-yellow-300', dot: 'bg-yellow-500', text: 'text-yellow-800', emoji: '🟡' },
  partial_recovery: { bg: 'bg-lime-50',   border: 'border-lime-300',   dot: 'bg-lime-500',   text: 'text-lime-800',   emoji: '🟢' },
  recovery:         { bg: 'bg-green-50',  border: 'border-green-300',  dot: 'bg-green-500',  text: 'text-green-800',  emoji: '✅' },
  none:             { bg: 'bg-green-50',  border: 'border-green-300',  dot: 'bg-green-500',  text: 'text-green-800',  emoji: '✅' },
  unknown:          { bg: 'bg-gray-50',   border: 'border-gray-200',   dot: 'bg-gray-400',   text: 'text-gray-600',   emoji: '⚪' },
}

export default function DroughtCard({ data, loading }: Props) {
  const { t } = useTranslation()

  if (loading) return <CardShell><Skeleton /></CardShell>
  if (!data) return null

  const cfg = LEVEL_CONFIG[data.level]

  return (
    <CardShell>
      <div className={`rounded-lg px-3 py-2.5 border ${cfg.bg} ${cfg.border}`}>
        <div className={`flex items-center gap-2 text-sm font-semibold ${cfg.text}`}>
          <span>{cfg.emoji}</span>
          {t(`risk.drought.${data.level}`)}
        </div>
      </div>
      <p className="text-xs text-gray-400">{t('risk.drought.source')}</p>
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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">☀️ {t('risk.drought.title')}</h3>
      {children}
    </div>
  )
}
