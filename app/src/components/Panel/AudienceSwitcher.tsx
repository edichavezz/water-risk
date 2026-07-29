import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import type { Audience } from '../../types/workspace'

const OPTIONS: Array<{ id: Audience; key: string }> = [
  { id: 'resident_owner', key: 'panel.audienceResident' },
  { id: 'buyer_investor', key: 'panel.audienceBuyer' },
]

/**
 * Delivers on the promise the entry card makes ("you can change this later").
 * Lives in PanelBody so the desktop panel and the mobile sheet both get it.
 * Changing it re-ranks the list and stales a ready interpretation; it never
 * refetches, because audience only ever influenced fetch order.
 */
export default function AudienceSwitcher() {
  const { t } = useTranslation()
  const audience = useAppStore(s => s.audience)
  const setAudience = useAppStore(s => s.setAudience)

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-xs text-muted">{t('panel.audienceLabel')}</span>
      <div className="flex gap-1">
        {OPTIONS.map(o => (
          <button
            key={o.id}
            type="button"
            aria-pressed={audience === o.id}
            // Pressing the active option clears it, matching the entry card.
            onClick={() => setAudience(audience === o.id ? null : o.id)}
            className={`rounded-lg border px-2 py-1 text-xs font-bold ${
              audience === o.id
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-border text-muted hover:bg-subtle-cool'
            }`}
          >
            {t(o.key)}
          </button>
        ))}
      </div>
    </div>
  )
}
