import { useTranslation } from 'react-i18next'

/**
 * The Live news tab, shell only.
 *
 * The three-tab layout is real now, but there is deliberately no fetch behind
 * this yet. Two reasons worth keeping in view when it is built:
 *
 * 1. No free news API offers true radius filtering. GDELT's `near20:` operator
 *    is *word* proximity, not geographic, and its GEO API returns aggregated
 *    map content rather than articles. So the feature can be "news mentioning
 *    this area" — toponym plus keyword, cached by municipality — but never
 *    "news within 20 km", which would be a promise the data cannot keep.
 * 2. Whatever ships must carry the honesty caption below: an automated
 *    keyword match is not verification, and a headline next to hazard data
 *    borrows that data's authority unless it is told not to.
 */
export default function NewsFeed() {
  const { t } = useTranslation()

  return (
    <div className="rounded-xl bg-subtle-warm p-4">
      <p className="font-title text-sm font-bold text-ink">{t('news.pendingTitle')}</p>
      <p className="mt-1 text-sm text-muted">{t('news.pendingBody')}</p>
      <p className="mt-3 text-xs text-muted">{t('news.disclaimer')}</p>
    </div>
  )
}
