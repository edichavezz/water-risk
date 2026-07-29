import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { requestInterpretation } from '../../services/ai'
import AudienceSwitcher from './AudienceSwitcher'
import DatasetList from './DatasetList'
import DatasetDetail from './DatasetDetail'
import InterpretationView from './InterpretationView'

/**
 * Mode tabs + depth switching, shared by the desktop panel and the mobile
 * sheet. Outside detailed coverage there are no dataset rows and no AI tab
 * (spec §15.2).
 */
export default function PanelBody() {
  const { t } = useTranslation()
  const coverage = useAppStore(s => s.coverage)
  const panelMode = useAppStore(s => s.panelMode)
  const panelDepth = useAppStore(s => s.panelDepth)
  const openDataMode = useAppStore(s => s.openDataMode)
  const openAiMode = useAppStore(s => s.openAiMode)
  const interpretation = useAppStore(s => s.interpretation)

  if (coverage && !coverage.supported) {
    return (
      <div className="rounded-xl border border-hairline bg-accent-soft/60 p-4">
        <p className="text-[13px] font-bold text-ink">{t('panel.unsupportedTitle')}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{t('panel.unsupportedBody')}</p>
      </div>
    )
  }

  const openAi = () => {
    openAiMode()
    // Opt-in only: generate on first request, or when a prior attempt failed
    // or went stale. A ready interpretation is simply shown again.
    if (['idle', 'stale', 'error'].includes(interpretation.status)) {
      void requestInterpretation({ type: 'location' })
    }
  }

  /* Underline tabs sitting on a shared hairline, not filled pills. The active
     underline runs teal for public data and terracotta for the AI tab — the
     one place the accent is used as a state signal, flagging "this side is
     AI-assisted" before anything is generated. The -mb-px pulls the 2px
     underline over the rail's own 1px line so they read as one edge. */
  const tabClass = (active: boolean, accent = false) =>
    `-mb-px min-h-11 border-b-2 pb-2.5 text-[13px] font-bold ${
      active
        ? `text-ink ${accent ? 'border-accent' : 'border-primary'}`
        : 'border-transparent text-tab-idle hover:text-ink'
    }`

  return (
    <>
      <AudienceSwitcher />

      <div role="tablist" className="mb-3.5 flex gap-[22px] border-b border-hairline">
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
          className={tabClass(panelMode === 'ai', true)}
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
