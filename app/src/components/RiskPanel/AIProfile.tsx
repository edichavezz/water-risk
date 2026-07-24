import { useTranslation } from 'react-i18next'

interface Props { summary?: string; loading: boolean }

export default function AIProfile({ summary, loading }: Props) {
  const { t } = useTranslation()

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-3 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-600">
        ✨ {t('risk.aiSummary.title')}
      </h3>

      {loading || !summary ? (
        <div className="space-y-2">
          <div className="h-3 bg-blue-100 rounded animate-pulse" />
          <div className="h-3 bg-blue-100 rounded animate-pulse w-5/6" />
          <div className="h-3 bg-blue-100 rounded animate-pulse w-4/6" />
          {loading && (
            <p className="text-xs text-blue-400 italic">{t('risk.aiSummary.loading')}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
      )}
    </div>
  )
}
