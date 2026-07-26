import { useTranslation } from 'react-i18next'
import type { WaterQualityResult } from '../../types'

interface Props { data: WaterQualityResult | null; loading: boolean }

const COMPLIANCE_CONFIG: Record<WaterQualityResult['compliance'], { bg: string; border: string; text: string; emoji: string }> = {
  compliant:     { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800', emoji: '✅' },
  minor_issues:  { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', emoji: '⚠️' },
  non_compliant: { bg: 'bg-red-50',   border: 'border-red-300',   text: 'text-red-800',   emoji: '❌' },
  unknown:       { bg: 'bg-gray-50',  border: 'border-gray-200',  text: 'text-gray-600',  emoji: '⚪' },
}

export default function WaterQualityCard({ data, loading }: Props) {
  const { t } = useTranslation()

  if (loading) return <CardShell><Skeleton /></CardShell>
  if (!data) {
    return <CardShell><p className="text-sm text-gray-500">{t('risk.waterQuality.noData')}</p></CardShell>
  }

  const cfg = COMPLIANCE_CONFIG[data.compliance]
  const params: { label: string; value: string }[] = []
  if (data.nitrates_mg_l !== undefined) params.push({ label: 'Nitrates', value: `${data.nitrates_mg_l} mg/L` })
  if (data.turbidity_ntu !== undefined) params.push({ label: 'Turbidity', value: `${data.turbidity_ntu} NTU` })
  if (data.ecoli) params.push({ label: 'E. coli', value: data.ecoli })

  return (
    <CardShell>
      <div className={`rounded-lg px-3 py-2.5 border ${cfg.bg} ${cfg.border}`}>
        <div className={`flex items-center gap-2 text-sm font-semibold ${cfg.text}`}>
          <span>{cfg.emoji}</span>
          {t(`risk.waterQuality.${data.compliance}`)}
        </div>
      </div>
      <p className="text-xs text-gray-600">{t(`risk.waterQuality.sourceType.${data.sourceType}`)}</p>
      {params.length > 0 && (
        <ul className="text-xs text-gray-500 space-y-0.5">
          {params.slice(0, 3).map(p => <li key={p.label}>{p.label}: {p.value}</li>)}
        </ul>
      )}
      <p className="text-xs text-gray-400 mt-1">{t('risk.waterQuality.source', { year: data.year })}</p>
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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">🚰 {t('risk.waterQuality.title')}</h3>
      {children}
    </div>
  )
}
