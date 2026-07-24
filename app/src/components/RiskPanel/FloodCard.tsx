import { useTranslation } from 'react-i18next'
import type { FloodZoneResult } from '../../types'

interface Props { data: FloodZoneResult | null; loading: boolean }

const PERIOD_CONFIG = {
  '10':  { label: 'T10 — High risk (1-in-10 yr)',  bg: 'bg-red-50',    border: 'border-red-300',    dot: 'bg-red-500',    text: 'text-red-800' },
  '100': { label: 'T100 — Moderate (1-in-100 yr)', bg: 'bg-orange-50', border: 'border-orange-300', dot: 'bg-orange-500', text: 'text-orange-800' },
  '500': { label: 'T500 — Low risk (1-in-500 yr)', bg: 'bg-yellow-50', border: 'border-yellow-300', dot: 'bg-yellow-500', text: 'text-yellow-800' },
}

export default function FloodCard({ data, loading }: Props) {
  const { t } = useTranslation()

  if (loading) return <CardShell title={t('risk.flood.title')}><Skeleton /></CardShell>
  if (!data) return null

  if (!data.inZone) {
    return (
      <CardShell title={t('risk.flood.title')}>
        <div className="flex items-center gap-2 text-sm text-green-700">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
          {t('risk.flood.notInZone')}
        </div>
        <Source />
      </CardShell>
    )
  }

  const cfg = PERIOD_CONFIG[data.returnPeriod ?? '100']
  return (
    <CardShell title={t('risk.flood.title')}>
      <div className={`rounded-lg px-3 py-2.5 border ${cfg.bg} ${cfg.border}`}>
        <div className={`flex items-center gap-2 text-sm font-semibold ${cfg.text}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} shrink-0`} />
          {t(`risk.flood.inZone${data.returnPeriod}`)}
        </div>
      </div>
      <p className="text-xs text-amber-700 mt-1.5 leading-relaxed">{t('risk.flood.caveat')}</p>
      <Source />
    </CardShell>
  )
}

function Source() {
  const { t } = useTranslation()
  return <p className="text-xs text-gray-400 mt-1">{t('risk.flood.source')}</p>
}

function Skeleton() {
  return <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
}

function CardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">🌊 {title}</h3>
      {children}
    </div>
  )
}
