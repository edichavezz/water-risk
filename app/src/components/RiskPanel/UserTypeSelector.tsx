import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { generateRiskSummary, generateQuestions } from '../../services/ai'
import type { UserType } from '../../types'

const USER_TYPES: { id: UserType; icon: string }[] = [
  { id: 'buyer',    icon: '🏠' },
  { id: 'renter',   icon: '🔑' },
  { id: 'farmer',   icon: '🌾' },
  { id: 'business', icon: '🏪' },
]

export default function UserTypeSelector() {
  const { t } = useTranslation()
  const { userType, setUserType, profile, updateProfile, language } = useAppStore()

  const handleChange = async (type: UserType) => {
    setUserType(type)

    // Re-run AI if we already have a profile
    if (!profile || profile.loading) return

    updateProfile({ aiSummary: undefined, aiQuestions: undefined })

    generateRiskSummary(profile, type, language).then(aiSummary => updateProfile({ aiSummary })).catch(() => {})
    generateQuestions(profile, type, language).then(aiQuestions => updateProfile({ aiQuestions })).catch(() => {})
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
        {t('userType.label')}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {USER_TYPES.map(({ id, icon }) => (
          <button
            key={id}
            onClick={() => handleChange(id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
              userType === id
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <span>{icon}</span>
            <span className="text-xs leading-tight">{t(`userType.${id}`)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
