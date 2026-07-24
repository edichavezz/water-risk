import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'

export default function LayerToggle() {
  const { t } = useTranslation()
  const { activeLayers, toggleLayer } = useAppStore()

  const layers: { key: keyof typeof activeLayers; emoji: string; label: string }[] = [
    { key: 'flood',       emoji: '🌊', label: t('layers.flood') },
    { key: 'drought',     emoji: '☀️', label: t('layers.drought') },
    { key: 'reservoirs',  emoji: '💧', label: t('layers.reservoirs') },
    { key: 'coastal',     emoji: '🏖', label: t('layers.coastal') },
    { key: 'groundwater', emoji: '🟤', label: t('layers.groundwater') },
  ]

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {layers.map(({ key, emoji, label }) => (
        <button
          key={key}
          onClick={() => toggleLayer(key)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            activeLayers[key]
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
          }`}
        >
          <span>{emoji}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
