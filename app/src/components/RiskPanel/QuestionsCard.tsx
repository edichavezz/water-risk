import { useTranslation } from 'react-i18next'

interface Props { questions?: string[]; loading: boolean }

export default function QuestionsCard({ questions, loading }: Props) {
  const { t } = useTranslation()

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        ❓ {t('risk.questions.title')}
      </h3>

      {loading || !questions ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-2 items-start">
              <div className="w-4 h-4 bg-gray-100 rounded-full animate-pulse shrink-0 mt-0.5" />
              <div className="flex-1 h-3 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
          {loading && (
            <p className="text-xs text-gray-400 italic">{t('risk.questions.loading')}</p>
          )}
        </div>
      ) : (
        <ol className="space-y-2">
          {questions.map((q, i) => (
            <li key={i} className="flex gap-2.5 items-start">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-gray-700 leading-snug">{q}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
