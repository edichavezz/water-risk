import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { requestInterpretation } from '../../services/ai'
import AudienceSwitcher from './AudienceSwitcher'
import DatasetList from './DatasetList'
import DatasetDetail from './DatasetDetail'
import InterpretationView from './InterpretationView'

/**
 * Mode tabs + depth switching, shared by the desktop panel and the mobile
 * sheet. Every place gets a list now; how much of it carries a result is the
 * list's business, not this component's.
 */
export default function PanelBody() {
  const { t } = useTranslation()
  const panelMode = useAppStore(s => s.panelMode)
  const panelDepth = useAppStore(s => s.panelDepth)
  const openDataMode = useAppStore(s => s.openDataMode)
  const openAiMode = useAppStore(s => s.openAiMode)
  const interpretation = useAppStore(s => s.interpretation)

  const openAi = () => {
    openAiMode()
    // Opt-in only: generate on first request, or when a prior attempt failed
    // or went stale. A ready interpretation is simply shown again.
    if (['idle', 'stale', 'error'].includes(interpretation.status)) {
      void requestInterpretation({ type: 'location' })
    }
  }

  const tabClass = (active: boolean) =>
    `min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-bold ${
      active ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-subtle-cool'
    }`

  return (
    <>
      <AudienceSwitcher />

      <div role="tablist" className="mb-3 flex gap-1 rounded-xl bg-subtle-warm p-1">
        <button
          role="tab"
          aria-selected={panelMode === 'data'}
          onClick={openDataMode}
          className={tabClass(panelMode === 'data')}
        >
          {t('panel.publicData')}
        </button>
        <button
          role="tab"
          aria-selected={panelMode === 'ai'}
          onClick={openAi}
          className={tabClass(panelMode === 'ai')}
        >
          {t('panel.aiTab')}
        </button>
      </div>

      {panelMode === 'ai'
        ? <InterpretationView />
        : panelDepth === 'detail'
          ? <DatasetDetail />
          : <DatasetList />}
    </>
  )
}
