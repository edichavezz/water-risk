import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import UserTypeSelector from './UserTypeSelector'
import FloodCard from './FloodCard'
import DroughtCard from './DroughtCard'
import ReservoirCard from './ReservoirCard'
import AIProfile from './AIProfile'
import QuestionsCard from './QuestionsCard'

export default function RiskPanel() {
  const { t } = useTranslation()
  const { profile } = useAppStore()

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-4">
        <div className="text-5xl">💧</div>
        <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
          {t('noLocation')}
        </p>
      </div>
    )
  }

  const { location, floodZone, drought, reservoirs, aiSummary, aiQuestions, loading } = profile

  const aiLoading = loading || (!aiSummary && !profile.error)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Location header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <p className="font-semibold text-gray-800 text-sm truncate">
          📍 {location.municipio || location.displayName.split(',')[0]}
        </p>
        {location.provincia && (
          <p className="text-xs text-gray-500">{location.provincia}</p>
        )}
        {location.basin && location.basin !== 'other' && (
          <p className="text-xs text-blue-600 capitalize">
            {location.basin} basin
          </p>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* User type */}
        <UserTypeSelector />

        <hr className="border-gray-100" />

        {/* Data cards */}
        <FloodCard data={floodZone} loading={loading} />
        <DroughtCard data={drought} loading={loading} />
        <ReservoirCard reservoirs={reservoirs} loading={loading} />

        <hr className="border-gray-100" />

        {/* AI content */}
        <AIProfile summary={aiSummary} loading={aiLoading} />
        <QuestionsCard questions={aiQuestions} loading={aiLoading} />

        {/* Data attribution */}
        <p className="text-xs text-gray-400 leading-relaxed pb-2">
          {t('attribution')}
        </p>
      </div>
    </div>
  )
}
